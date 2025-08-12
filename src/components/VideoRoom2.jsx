// VideoRoom.jsx
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
// import "bootstrap/dist/css/bootstrap.min.css";

const SIGNALING_SERVER = "http://localhost:5000"; // change to your server
const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export default function VideoRoom({ roomId }) {
  const socketRef = useRef();
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const [remoteStreams, setRemoteStreams] = useState([]);
  const localVideoRef = useRef(null);

  // screen share
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  useEffect(() => {
    socketRef.current = io(SIGNALING_SERVER);

    async function initLocal() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      joinRoom();
    }
    initLocal();

    return () => {
      Object.values(peersRef.current).forEach(pc => pc.close());
      socketRef.current?.disconnect();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [roomId]);

  function joinRoom() {
    socketRef.current.emit("join-room", roomId);

    socketRef.current.on("all-users", (users) => {
      users.forEach((userId) => {
        createPeerConnection(userId, true);
      });
    });

    socketRef.current.on("user-joined", (userId) => {
      createPeerConnection(userId, false);
    });

    socketRef.current.on("offer", async ({ offer, from }) => {
      if (!peersRef.current[from]) await createPeerConnection(from, false);
      const pc = peersRef.current[from];
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit("answer", { answer: pc.localDescription, to: from });
    });

    socketRef.current.on("answer", async ({ answer, from }) => {
      const pc = peersRef.current[from];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socketRef.current.on("ice-candidate", async ({ candidate, from }) => {
      const pc = peersRef.current[from];
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("addIce failed", e);
      }
    });

    socketRef.current.on("user-left", (userId) => {
      const pc = peersRef.current[userId];
      if (pc) pc.close();
      delete peersRef.current[userId];
      setRemoteStreams((s) => s.filter(r => r.id !== userId));
    });
  }

  async function createPeerConnection(peerId, isInitiator) {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", { candidate: event.candidate, to: peerId });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStreams((existing) => {
        if (existing.find(r => r.id === peerId)) {
          return existing.map(r => r.id === peerId ? { id: peerId, stream } : r);
        } else {
          return [...existing, { id: peerId, stream }];
        }
      });
    };

    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    peersRef.current[peerId] = pc;

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit("offer", { offer: pc.localDescription, to: peerId });
    }
  }

  async function startScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      Object.values(peersRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

      // change local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      screenTrack.onended = () => stopScreenShare();
      setIsSharingScreen(true);
    } catch (err) {
      console.error("Screen share error:", err);
    }
  }

  function stopScreenShare() {
    const camTrack = localStreamRef.current.getVideoTracks()[0];
    Object.values(peersRef.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track.kind === "video");
      if (sender) sender.replaceTrack(camTrack);
    });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setIsSharingScreen(false);
  }

  return (
    <div className="container py-4 bg-dark text-light" style={{ minHeight: "100vh" }}>
      <h2 className="mb-3">Room: {roomId}</h2>

      <div className="d-flex gap-3 flex-wrap">
        <div className="card bg-secondary p-2" style={{ width: 320 }}>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "100%", borderRadius: 8 }} />
          <div className="mt-2 text-center">You</div>
        </div>

        <div className="flex-grow-1 d-flex flex-wrap gap-2">
          {remoteStreams.map(r => (
            <div key={r.id} className="card bg-secondary p-2" style={{ width: 240 }}>
              <video
                style={{ width: "100%", borderRadius: 8 }}
                autoPlay
                playsInline
                ref={(el) => { if (el && !el.srcObject) el.srcObject = r.stream; }}
              />
              <div className="mt-2 text-center">{r.id}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 d-flex gap-2">
        {!isSharingScreen ? (
          <button className="btn btn-warning" onClick={startScreenShare}>
            Share Screen
          </button>
        ) : (
          <button className="btn btn-danger" onClick={stopScreenShare}>
            Stop Sharing
          </button>
        )}
      </div>
    </div>
  );
}
