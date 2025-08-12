import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "../src/index.css"
import Home from "./components/HomePage ";
import ScreenRecorder from "./components/ScreenRecording";
import VideoRoom from "./components/VideoRoom";
import Login from "./components/Login";
import MainHome from "./components/MainHome";

// Wrapper so we can use navigate inside Router
function HomeWrapper({ username, setUsername }) {
  const navigate = useNavigate();
  function handleEnterRoom(roomId) {
    navigate(`/video-call/${roomId}`);
  }

  // Agar login nahi to login page dikhao
  if (!username) {
    return <Login onLogin={(name) => setUsername(name)} />;
  }

  return <Home username={username} onEnterRoom={handleEnterRoom} />;
}

function App() {
  const [username, setUsername] = useState(null);

  return (
    
      <Routes>
        {/* App khulte hi MainHome show hoga */}
        <Route path="/" element={<MainHome />} />

        {/* Video Call ke liye login process */}
        <Route
          path="/video"
          element={<HomeWrapper username={username} setUsername={setUsername} />}
        />

        {/* Video Room join karne ke liye */}
        <Route
          path="/video-call/:roomId"
          element={ 
            username ? (
              <VideoRoom username={username} />
            ) : (
              <Navigate to="/video" />
            )
          }
        />

        {/* Screen recording direct access */}
        <Route path="/screen-record" element={<ScreenRecorder />} />

        {/* Agar path galat ho to MainHome pe bhej do */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
   
  );
}

export default App;
