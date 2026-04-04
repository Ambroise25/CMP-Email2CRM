import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { spawn, ChildProcess } from "child_process";

let pythonProcess: ChildProcess | null = null;

function startPythonServer() {
  if (pythonProcess) {
    return;
  }
  
  console.log("Starting Python IMAP server on port 5001...");
  pythonProcess = spawn("python", ["main.py"], {
    stdio: "inherit",
    env: process.env
  });
  
  pythonProcess.on("error", (err) => {
    console.error("Failed to start Python server:", err);
  });
  
  pythonProcess.on("exit", (code) => {
    console.log(`Python server exited with code ${code}`);
    pythonProcess = null;
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Start the Python IMAP server
  startPythonServer();
  
  // Proxy requests to Python server
  app.get("/api/imap/test", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/imap/test");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ connected: false, error: "Python server not available" });
    }
  });
  
  app.get("/api/emails/unread", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/emails/unread");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  app.get("/api/emails/unread/all", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/emails/unread/all");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  app.post("/api/emails/parse", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/emails/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  app.post("/api/emails/fetch-and-parse", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/emails/fetch-and-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  app.get("/api/demandes", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/demandes");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  app.get("/api/demandes/:id", async (req, res) => {
    try {
      const response = await fetch(`http://localhost:5001/api/demandes/${req.params.id}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  app.post("/api/demandes/clear", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/demandes/clear", { method: "POST" });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  app.post("/api/emails/:email_id/unarchive", async (req, res) => {
    try {
      const response = await fetch(`http://localhost:5001/api/emails/${req.params.email_id}/unarchive`, {
        method: "POST"
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  // CRM routes
  app.post("/api/crm/send", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/crm/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  // Polling routes
  app.get("/api/polling/status", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/polling/status");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ enabled: false, error: "Python server not available" });
    }
  });

  app.post("/api/polling/start", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/polling/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  app.post("/api/polling/stop", async (req, res) => {
    try {
      const response = await fetch("http://localhost:5001/api/polling/stop", {
        method: "POST"
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ success: false, error: "Python server not available" });
    }
  });

  return httpServer;
}
