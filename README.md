# Alcovia Study App - Offline-First Sync & Idempotency Take-Home

Alcovia is an offline-first study app with features for Focus Sessions and Syllabus Progress. It supports synchronization across multiple devices, conflict resolution via Lamport revision rules, and idempotent reward calculations and notifications.

## Stack
- **Frontend**: TypeScript, React Native (Expo Web)
- **Backend**: TypeScript, Express, MongoDB (Mongoose)
- **Automation**: n8n

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas (URI configured in `backend/.env`)
- n8n (for the automation layer)

---

### 1. Setup & Run the Backend
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   *The backend will listen on port `4000` and automatically connect to MongoDB and seed initial tasks.*

---

### 2. Setup & Run the Frontend
1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the web client:
   ```bash
   npm run web
   ```
   *The client opens in Metro Bundler at `http://localhost:8081`.*

---

### 3. Setup n8n Workflow
1. Start n8n locally or log into n8n cloud.
2. Create a new workflow, click the top-right menu icon (three dots), and select **Import from File**.
3. Import [n8n-workflow.json](file:///Users/mac/Documents/Projects/assessments/alcovia/n8n-workflow.json).
4. Save and active the workflow.
5. In n8n, the Webhook Trigger listens on `http://localhost:5678/webhook/alcovia-focus-success` (or whichever Webhook URL is configured under your n8n configuration). Make sure n8n active webhooks match this URL path.

---

## Simulation Scenarios to Try in the Dev Panel
Open the web app. You will see **Device A (Phone)** and **Device B (Laptop)** side-by-side:

### Scenario 1: Task Editing & Conflict Resolution
1. Toggle both devices **Offline** using their green status buttons.
2. On **Device A**, change the status of "Quadratic Equations" to `In Progress`.
3. On **Device B**, change the status of "Quadratic Equations" to `Done`.
4. Toggle **Device A** back to **Online**. It will sync to the server.
5. Toggle **Device B** back to **Online**.
6. Observe that both devices converge to the exact same state (Device B's update wins since they had matching revisions but Device B has lexicographical tie-breaker superiority, or whoever modified last depending on revision numbers).

### Scenario 2: Task Deletion vs. Editing
1. Toggle both devices **Offline**.
2. On **Device A**, delete the task "Pythagoras Theorem".
3. On **Device B**, update "Pythagoras Theorem" to `In Progress`.
4. Toggle both devices back to **Online**.
5. Observe that the task is deleted on both devices (reconciled correctly!).

### Scenario 3: Focus Timer, Rewards & Notification Idempotency
1. Toggle **Device A** **Offline**.
2. Start a focus session.
3. Click the green **⚡ Fast Forward (Succeed)** button to immediately complete the session. Notice that local stats (Coins, Streak) increase instantly.
4. Toggle **Device A** **Online**. It will sync.
5. Look at the **n8n Webhook / Notification Log** panel on the right. You will see a single notification: `"WhatsApp Notification: Focus session succeeded! Streak now 1 days, +50 coins."`
6. Sync the device multiple times (or let it auto-sync). Observe that no duplicate notifications are fired, and the streak/coins are not double-rewarded.
