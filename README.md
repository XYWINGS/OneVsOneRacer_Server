
# 🏎️ OneVSOne Backend – Real-Time Multiplayer Game Server

This is the **backend server** for [OneVSOne](https://github.com/your-username/onevsone-client), a real-time top-down 2-player racing game built with WebSockets using NestJS and Socket.IO.

It handles **room management**, **player connections**, **real-time movement sync**, and **race state coordination** between two players in each match.

---

## 🧱 Tech Stack

| Purpose             | Tech                     |
|---------------------|--------------------------|
| Framework           | NestJS                   |
| Real-Time Comm      | WebSockets (Socket.IO)   |
| State Management    | In-memory (per room)     |
| Containerization    | Docker                   |
| Dev Tools           | ESLint, Prettier         |

---

## 🚀 Running the Server

### 1. Install dependencies

```bash
npm install
````

### 2. Run in dev mode

```bash
npm run start:dev
```

Server will start on [http://localhost:4000](http://localhost:4000)

---

## 🔌 WebSocket Events Overview

| Event            | Direction       | Description                   |
| ---------------- | --------------- | ----------------------------- |
| `createRoom`     | Client → Server | Create a new 1v1 race room    |
| `joinRoom`       | Client → Server | Join an existing room         |
| `startCountdown` | Server → Client | Start race countdown          |
| `playerMove`     | Client → Server | Send updated position, angle  |
| `updateOpponent` | Server → Client | Broadcast opponent's position |
| `finishRace`     | Client → Server | Notify server of race finish  |
| `gameOver`       | Server → Client | Notify both players of winner |

---

## 📌 TODOs & Roadmap

* [ ] Matchmaking queue
* [ ] Redis integration for state sync
* [ ] Race replay (ghost runs)
* [ ] Unit & e2e tests with Jest
* [ ] Rate limiting & abuse prevention

