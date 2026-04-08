const fs = require('fs');
const path = require('path');

// Target file
const filePath = path.join(__dirname, 'coord.json');

function convertOptions() {
  try {
    // 1. Read the local coord.json file
    const rawData = fs.readFileSync(filePath, 'utf8');
    const geojson = JSON.parse(rawData);

    if (!geojson.features || !Array.isArray(geojson.features)) {
      throw new Error("Invalid format: 'features' array not found in the input JSON.");
    }

    const coordMap = {};
    let skippedCount = 0;

    // 2. Iterate over the features array
    for (const feature of geojson.features) {
      // 3. Defensively check for required fields: properties.code, geometry, geometry.coordinates
      if (
        feature &&
        feature.properties &&
        typeof feature.properties.code === 'string' &&
        feature.properties.code.trim() !== '' &&
        feature.geometry &&
        Array.isArray(feature.geometry.coordinates) &&
        feature.geometry.coordinates.length >= 2
      ) {
        const code = feature.properties.code.trim();
        
        // 4. Extract lng (index 0) and lat (index 1)
        const lng = feature.geometry.coordinates[0];
        const lat = feature.geometry.coordinates[1];

        // Ensure both are valid numbers before adding them
        if (typeof lat === 'number' && typeof lng === 'number') {
          coordMap[code] = { lat, lng };
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++; // Skip if malformed or missing data
      }
    }

    // 5. Write the final result object back to coord.json
    fs.writeFileSync(filePath, JSON.stringify(coordMap, null, 2), 'utf8');

    console.log(`✅ Success! Extracted ${Object.keys(coordMap).length} station coordinates.`);
    if (skippedCount > 0) {
      console.log(`⚠️ Skipped ${skippedCount} features due to missing or malformed data.`);
    }
    console.log(`📁 File written to: ${filePath}`);

  } catch (error) {
    console.error('❌ Error processing the GeoJSON file:', error.message);
  }
}

// Run the script
convertOptions();
