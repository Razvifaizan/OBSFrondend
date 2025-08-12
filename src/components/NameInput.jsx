import React, { useState } from "react";

export default function NameInput({ onSubmit }) {
  const [name, setName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim() === "") {
      alert("Please enter your name");
      return;
    }
    onSubmit(name.trim());
  };

  return (
    <div style={{ maxWidth: 400, margin: "auto", paddingTop: 50, textAlign: "center" }}>
      <h2>Enter your name to continue</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 10, width: "80%", fontSize: 16 }}
        />
        <br />
        <button type="submit" style={{ marginTop: 20, padding: "10px 20px", fontSize: 16 }}>
          Continue
        </button>
      </form>
    </div>
  );
}
