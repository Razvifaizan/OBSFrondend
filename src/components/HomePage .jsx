import React, { useEffect, useState } from "react";
import socket from "./socket";
import { v4 as uuidv4 } from "uuid";

export default function Home({ username, onEnterRoom }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (!username) return;
    socket.emit("register", username);

    socket.on("onlineUsers", (list) => setOnlineUsers(list.filter((u) => u !== username)));

    socket.on("invitation", ({ roomId, from }) => {
      const accept = window.confirm(`${from} invited you to a call. Join?`);
      if (accept) {
        socket.emit("join-room", { roomId, username });
        if (typeof onEnterRoom === "function") onEnterRoom(roomId);
      }
    });

    socket.on("userNotAvailable", ({ username: u }) => {
      alert(`${u} is not available`);
    });

    return () => {
      socket.off("onlineUsers");
      socket.off("invitation");
      socket.off("userNotAvailable");
    };
  }, [username, onEnterRoom]);

  function toggleSelect(u) {
    const s = new Set(selected);
    s.has(u) ? s.delete(u) : s.add(u);
    setSelected(s);
  }

  function startCall() {
    if (selected.size === 0) {
      alert("Select at least one user");
      return;
    }
    const roomId = uuidv4();
    socket.emit("create-room", { host: username, roomId });
    socket.emit("join-room", { roomId, username });
    socket.emit("invite-users", { roomId, invited: Array.from(selected), from: username });
    if (typeof onEnterRoom === "function") onEnterRoom(roomId);
  }

  return (
    <div className="center">
      <div className="card">
        <h3>Hello, {username}</h3>
        <p>Select users to call</p>
        <div style={{ maxHeight: 220, overflow: "auto", textAlign: "left" }}>
          {onlineUsers.length === 0 && <div className="muted">No other users online</div>}
          {onlineUsers.map((u) => (
            <label key={u} style={{ display: "block", padding: 6 }}>
              <input type="checkbox" checked={selected.has(u)} onChange={() => toggleSelect(u)} /> <b>{u}</b>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={startCall}>Start Call with Selected</button>
        </div>
      </div>
    </div>
  );
}
