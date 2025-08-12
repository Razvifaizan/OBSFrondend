import React, { useEffect, useRef, useState } from "react";
import "./CallComponent.css"; // new CSS file

export default function CallPage({ username, peerUsername, socket, STUN, onHangup }) {
  const localRef = useRef();
  const remoteRef = useRef();
  const pcRef = useRef(null);
  const [status, setStatus] = useState("Connecting...");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const localStreamRef = useRef(null);

  useEffect(() => {
    if (!socket) {
      console.error("❌ Socket not provided to CallPage!");
      return;
    }

    let mounted = true;
    pcRef.current = new RTCPeerConnection(STUN);

    pcRef.current.ontrack = (e) => {
      if (remoteRef.current) {
        remoteRef.current.srcObject = e.streams[0];
      }
    };

    pcRef.current.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("signal", {
          to: peerUsername,
          data: { candidate: e.candidate }
        });
      }
    };

    socket.on("signal", async ({ data }) => {
      try {
        if (data.type === "offer") {
          await pcRef.current.setRemoteDescription(data);
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          socket.emit("signal", {
            to: peerUsername,
            data: pcRef.current.localDescription
          });
        } else if (data.type === "answer") {
          await pcRef.current.setRemoteDescription(data);
        } else if (data.candidate) {
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate || data)
          );
        }
      } catch (err) {
        console.error("signal handling error", err);
      }
    });

    const startLocal = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        if (!mounted) return;
        localStreamRef.current = stream;
        localRef.current.srcObject = stream;
        stream.getTracks().forEach((t) => pcRef.current.addTrack(t, stream));
      } catch (err) {
        console.error("Error accessing media devices:", err);
        setStatus("Failed to access camera/mic");
      }
    };

    startLocal();

    return () => {
      mounted = false;
      socket.off("signal");
      try {
        pcRef.current.close();
      } catch {}
      const s = localRef.current?.srcObject;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
      }
    };
  }, [socket, peerUsername, STUN]);

  const createOffer = async () => {
    try {
      setStatus("Creating offer...");
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      socket.emit("signal", {
        to: peerUsername,
        data: pcRef.current.localDescription
      });
      setStatus("Offer sent, waiting for answer...");
    } catch (err) {
      console.error(err);
    }
  };

  const hangup = () => {
    try {
      pcRef.current.close();
    } catch {}
    onHangup();
  };

  const toggleMic = () => {
    const s = localRef.current?.srcObject;
    if (!s) return;
    s.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((prev) => !prev);
  };

  const toggleCam = () => {
    const s = localRef.current?.srcObject;
    if (!s) return;
    s.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((prev) => !prev);
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pcRef.current.getSenders().find(s => s.track.kind === "video");
        sender.replaceTrack(screenTrack);
        localRef.current.srcObject = screenStream;
        setIsScreenSharing(true);
        screenTrack.onended = () => {
          sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
          localRef.current.srcObject = localStreamRef.current;
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.error("Error starting screen share:", err);
      }
    } else {
      const sender = pcRef.current.getSenders().find(s => s.track.kind === "video");
      sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
      localRef.current.srcObject = localStreamRef.current;
      setIsScreenSharing(false);
    }
  };

  return (
    <div className="call-page">
      <div className="call-header">
        <h2>{username} ↔ {peerUsername}</h2>
        <p className="status-text">{status}</p>
      </div>

      <div className="video-section">
        <video ref={localRef} autoPlay muted playsInline className="video-box" />
        <video ref={remoteRef} autoPlay playsInline className="video-box" />
      </div>

      <div className="control-bar">
        <button onClick={toggleMic} className="control-btn mic">
          {micOn ? "🎤" : "🔇"}
        </button>
        <button onClick={toggleCam} className="control-btn cam">
          {camOn ? "📷" : "🚫"}
        </button>
        <button onClick={toggleScreenShare} className="control-btn share">
          {isScreenSharing ? "🛑" : "🖥️"}
        </button>
        <button onClick={hangup} className="control-btn end">
          🔴
        </button>
        <button onClick={createOffer} className="control-btn offer">
          📡
        </button>
      </div>
    </div>
  );
}
