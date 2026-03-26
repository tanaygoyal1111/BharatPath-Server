# BharatPath - Backend 🚀

The robust, scalable backend for **BharatPath**, the ultimate travel companion for Indian Railways passengers. This server handles real-time journey tracking, seat exchange networking, and security services.

---

## 🌟 Key Features

- **Live PNR Tracking**: Sophisticated PNR status monitoring and automated lifecycle updates.
- **Seat Exchange Network**: An intelligent matchmaking system for passengers looking to swap or relocate seats.
- **SOS & Security**: Integrated emergency response system with direct links to RailMadad and local railway authorities.
- **Offline Journey Hub**: Secure, cryptographically verified offline journey data for areas with low connectivity.
- **Station Intelligence**: Resolvability for over 8,000+ Indian Railway station codes with detailed junction data.

---

## 🛠️ Tech Stack

- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + Auth)
- **Caching**: [Redis](https://redis.io/) for high-speed PNR lookups
- **Validation**: [Zod](https://zod.dev/) for robust schema validation
- **Middleware**: [Express.js](https://expressjs.com/)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18.x or higher)
- npm or yarn
- Supabase Project (URL and Anon Key)
- Redis Server (Optional, for caching features)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tanaygoyal1111/BharatPath-Server.git
   cd BharatPath-Server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   REDIS_URL=redis://localhost:6379
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

---

## 🛤️ Roadmap

- [ ] Implement multi-language support (Hindi/English).
- [ ] AI-powered seat availability predictions.
- [ ] Real-time WebSocket notifications for train delays.
- [ ] Community-driven station facility ratings.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 📧 Contact

**Project Lead**: [Tanay Goyal](https://github.com/tanaygoyal1111)  
**Project Link**: [https://github.com/tanaygoyal1111/BharatPath-Server](https://github.com/tanaygoyal1111/BharatPath-Server)
