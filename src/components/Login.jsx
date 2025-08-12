import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [userName, setUsername] = useState("");
  return (
    <div className="center">
      <div className="card">
        <div className="login_card">
          <h2>Login</h2>
          <input placeholder="Enter username (unique)" value={userName} onChange={(e) => setUsername(e.target.value)} />
          <button onClick={() => userName && onLogin(userName)}>Enter</button>
        </div>
      </div>
    </div>
  );
}
