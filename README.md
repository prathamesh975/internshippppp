# Graph Builder Demo

This project consists of a React/Vite Frontend (visual graph builder) and a FastAPI/LangGraph Backend (executes the graphs using AWS Bedrock).

## Prerequisites
- Node.js (v18+)
- Python (3.10+)
- AWS Credentials configured in your environment (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` and `AWS_REGION` like `us-east-1`), needed for Bedrock access.

## How to Run the Demo

To run this demo properly, you need to open two separate terminal windows—one for the backend and one for the frontend.

### 1. Start the Backend Server
Open your first terminal and run:
```bash
cd backend
pip install -r requirements.txt
python server.py
```
*The backend will start running on `http://localhost:8001`.*

### 2. Start the Frontend Server
Open your second terminal and run:
```bash
npm install
npm run dev
```
*The frontend will start running on `http://localhost:3000`.*

### 3. Build & Test a Graph
1. Open your browser and navigate to `http://localhost:3000`.
2. Drag and drop nodes (e.g., **Chat Input** -> **Agent** -> **Chat Output**).
3. Connect the output of the Chat Input to the **Input** handle of the Agent.
4. Type your instructions/system prompt in the Agent node's text box.
5. Connect the **Response** of the Agent to the input of the Chat Output.
6. Click the purple **Publish** rocket icon.
7. Click the green **Test Flow** chat bubble icon.
8. Type a message and hit send! The message will be routed to the backend and processed dynamically.
