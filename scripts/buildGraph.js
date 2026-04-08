/**
 * ============================================================
 * BharatPath — Railway Graph Generator (Offline BFS Engine)
 * ============================================================
 *
 * Parses train_info.csv and train_schedule.csv to produce an
 * optimised adjacency-list graph written to:
 *     src/data/offline_graph.json
 *
 * Output shape:
 *   graph[Source_Code][Dest_Code] = [
 *     { train, name, departs, arrives, distance }
 *   ]
 *
 * Usage:  node scripts/buildGraph.js
 * ============================================================
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');

// ── Paths ───────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const TRAIN_INFO_PATH = path.join(DATA_DIR, 'train_info.csv');
const TRAIN_SCHEDULE_PATH = path.join(DATA_DIR, 'train_schedule.csv');
const OUTPUT_PATH = path.join(DATA_DIR, 'offline_graph.json');

// ── Helpers ─────────────────────────────────────────────────

/**
 * Parse a single CSV line that may contain quoted fields with commas.
 * Strips surrounding double-quotes from each field.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Format time from HH:MM:SS to H:MM (drops seconds and leading zero for hours)
 * to save bytes in the final JSON string.
 */
function formatTime(t) {
  if (!t || t === '') return '0:00';
  let parts = t.split(':');
  if (parts.length < 2) return '0:00';
  return parseInt(parts[0], 10) + ':' + parts[1];
}

/**
 * Stream-read a CSV file line-by-line. Invokes `onRow(fields, index)`
 * for every data row (header is skipped). Returns a Promise.
 */
function streamCSV(filePath, onRow) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    let lineIndex = 0;

    rl.on('line', (raw) => {
      const line = raw.replace(/\r$/, ''); // normalise Windows line-endings
      if (lineIndex === 0) {
        lineIndex++;
        return; // skip header row
      }
      const fields = parseCSVLine(line);
      onRow(fields, lineIndex);
      lineIndex++;
    });

    rl.on('close', () => resolve(lineIndex - 1)); // total data rows
    rl.on('error', reject);
  });
}

// ── Step A: Parse train_info.csv ────────────────────────────

async function buildTrainNames() {
  console.log('📄 Step A — Parsing train_info.csv …');
  const trainNames = {}; // trainNames[Train_No] = Train_Name

  const total = await streamCSV(TRAIN_INFO_PATH, (fields) => {
    // "Train_No","Train_Name","Source_Station_Name","Destination_Station_Name","days"
    const trainNo = fields[0];
    const trainName = fields[1];
    if (trainNo && (trainNo.startsWith('1') || trainNo.startsWith('2'))) {
      trainNames[trainNo] = trainName || '';
    }
  });

  console.log(`   ✔ Loaded ${Object.keys(trainNames).length} train names (${total} rows).`);
  return trainNames;
}

// ── Step B: Parse train_schedule.csv ────────────────────────

async function buildTrainRoutes() {
  console.log('📄 Step B — Parsing train_schedule.csv …');

  // trainRoutes[Train_No] = [ { sn, stationCode, arrival, departure, distance } ]
  const trainRoutes = {};
  let skipped = 0;
  const LOG_INTERVAL = 50_000;

  const total = await streamCSV(TRAIN_SCHEDULE_PATH, (fields, idx) => {
    // "SN","Train_No","Station_Code","1A","2A","3A","SL","Station_Name",
    // "Route_Number","Arrival_time","Departure_Time","Distance"
    const sn = parseInt(fields[0], 10);
    const trainNo = fields[1];
    const stationCode = fields[2];
    const arrival = fields[9];   // Arrival_time
    const departure = fields[10]; // Departure_Time
    const distance = parseInt(fields[11], 10);

    // Task 1: Prune non-express trains (exclude if it doesn't start with 1 or 2, or isn't 5 digits)
    if (trainNo.length !== 5 || (!trainNo.startsWith('1') && !trainNo.startsWith('2'))) {
      skipped++;
      return;
    }

    // ── Edge-case guard ──
    if (!stationCode || stationCode === '' || isNaN(sn)) {
      skipped++;
      return;
    }

    // Strip seconds to hit size target (HH:MM:SS -> H:MM)
    if (!trainRoutes[trainNo]) {
      trainRoutes[trainNo] = [];
    }

    trainRoutes[trainNo].push({
      sn,
      stationCode,
      arrival: formatTime(arrival),
      departure: formatTime(departure),
      distance: isNaN(distance) ? 0 : distance,
    });

    // Progress logging
    if (idx % LOG_INTERVAL === 0) {
      console.log(`   … processed ${idx.toLocaleString()} rows`);
    }
  });

  // Sort each route by sequence number
  const trainCount = Object.keys(trainRoutes).length;
  for (const trainNo of Object.keys(trainRoutes)) {
    trainRoutes[trainNo].sort((a, b) => a.sn - b.sn);
  }

  console.log(`   ✔ Built routes for ${trainCount} trains (${total} rows, ${skipped} skipped).`);
  return trainRoutes;
}

// ── Step C: Build Adjacency List ────────────────────────────

function buildGraph(trainRoutes) {
  console.log('🔨 Step C — Building adjacency list …');

  // graph[src][dest] = [ [train, departs, arrives] ]
  const graph = {};
  let edgeCount = 0;
  let trainsDone = 0;
  const totalTrains = Object.keys(trainRoutes).length;
  const TRAIN_LOG_INTERVAL = 2_000;

  for (const [trainNo, stops] of Object.entries(trainRoutes)) {
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        const src = stops[i].stationCode;
        const dest = stops[j].stationCode;
        const departs = stops[i].departure;
        const arrives = stops[j].arrival;

        if (!graph[src]) graph[src] = {};
        if (!graph[src][dest]) graph[src][dest] = [];

        // Task 3: Tuple array [TrainNo, Departs, Arrives]
        graph[src][dest].push([parseInt(trainNo, 10), departs, arrives]);
        edgeCount++;
      }
    }

    trainsDone++;
    if (trainsDone % TRAIN_LOG_INTERVAL === 0) {
      console.log(`   … ${trainsDone.toLocaleString()} / ${totalTrains.toLocaleString()} trains processed`);
    }
  }

  console.log(`   ✔ Graph complete — ${Object.keys(graph).length} stations, ${edgeCount.toLocaleString()} edges.`);
  return graph;
}

// ── Step D: Write output ────────────────────────────────────

function writeGraph(trainNames, graph) {
  console.log('💾 Step D — Writing offline_graph.json …');
  
  // Task 2: Build train_metadata dictionary
  const outputData = {
    train_metadata: trainNames,
    graph: graph
  };

  const json = JSON.stringify(outputData);
  fs.writeFileSync(OUTPUT_PATH, json, 'utf-8');
  const sizeMB = (Buffer.byteLength(json, 'utf-8') / (1024 * 1024)).toFixed(2);
  console.log(`   ✔ Written to ${OUTPUT_PATH} (${sizeMB} MB)`);
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log('\n🚂 BharatPath — Railway Graph Generator\n');
  const t0 = Date.now();

  const trainNames = await buildTrainNames();
  const trainRoutes = await buildTrainRoutes();
  const graph = buildGraph(trainRoutes);
  writeGraph(trainNames, graph);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${elapsed}s\n`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
