import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "./socket";

// const PC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const PC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }, // Free STUN
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};
 // Free STUN

export default function VideoRoom({ username }) {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef();
  const localStreamRef = useRef(null);
  const pcsRef = useRef({});

  const [remoteStreams, setRemoteStreams] = useState([]); // {id, stream}
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mutedRemoteIds, setMutedRemoteIds] = useState(new Set());
  const [incomingInvite, setIncomingInvite] = useState(null);

  useEffect(() => {
    if (!roomId || !username) {
      navigate("/");
      return;
    }

    // Register username with socket
    socket.emit("register", username);

    socket.on("all-users", (otherSocketIds) => {
      otherSocketIds.forEach((sid) => {
        createPeerConnection(sid, true);
      });
    });

    socket.on("user-joined", ({ socketId, username: newUser }) => {
      console.info(`${newUser} joined with socket ${socketId}`);
    });

    socket.on("user-left", ({ socketId }) => {
      if (pcsRef.current[socketId]) {
        pcsRef.current[socketId].close();
        delete pcsRef.current[socketId];
      }
      setRemoteStreams((streams) => streams.filter((r) => r.id !== socketId));
      setMutedRemoteIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(socketId);
        return newSet;
      });
    });

    socket.on("signal", async ({ from, data }) => {
      if (!from || !data) return;
      let pc = pcsRef.current[from];

      try {
        if (data.type === "offer") {
          if (!pc) pc = createPeerConnection(from, false);
          await pc.setRemoteDescription(data);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", { toSocketId: from, data: pc.localDescription });

        } else if (data.type === "answer" && pc) {
          await pc.setRemoteDescription(data);

        } else if (data.candidate && pc) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (error) {
        console.error("Signal error:", error);
      }
    });

    socket.on("invitation", ({ roomId: inviteRoomId, from }) => {
      setIncomingInvite({ roomId: inviteRoomId, from });
    });

    // Get camera/mic stream
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        socket.emit("join-room", { roomId, username });
      } catch (e) {
        alert("Camera and microphone permission required.");
        navigate("/");
      }
    })();

    return () => {
      socket.off("all-users");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("signal");
      socket.off("invitation");

      Object.values(pcsRef.current).forEach((pc) => pc.close());
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      pcsRef.current = {};
    };
  }, [roomId, username, navigate]);

  function createPeerConnection(peerSocketId, isInitiator) {
    if (pcsRef.current[peerSocketId]) return pcsRef.current[peerSocketId];

    const pc = new RTCPeerConnection(PC_CONFIG);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", {
          toSocketId: peerSocketId,
          data: { candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStreams((prev) => {
        const exists = prev.find((r) => r.id === peerSocketId);
        if (exists) {
          return prev.map((r) => (r.id === peerSocketId ? { id: peerSocketId, stream } : r));
        }
        return [...prev, { id: peerSocketId, stream }];
      });
    };

    pcsRef.current[peerSocketId] = pc;

    if (isInitiator) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("signal", { toSocketId: peerSocketId, data: pc.localDescription });
        } catch (error) {
          console.error("Offer creation error:", error);
        }
      })();
    }

    return pc;
  }

  function toggleMic() {
    if (!localStreamRef.current) return;
    const enabled = !micOn;
    localStreamRef.current.getAudioTracks().forEach((track) => (track.enabled = enabled));
    setMicOn(enabled);
  }

  function toggleCam() {
    if (!localStreamRef.current) return;
    const enabled = !camOn;
    localStreamRef.current.getVideoTracks().forEach((track) => (track.enabled = enabled));
    setCamOn(enabled);
  }

  function toggleRemoteMute(id) {
    setMutedRemoteIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }

  async function toggleScreenShare() {
    try {
      const isSharing = localVideoRef.current?.srcObject !== localStreamRef.current;
      if (!isSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        Object.values(pcsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });

        localVideoRef.current.srcObject = screenStream;

        screenTrack.onended = () => {
          Object.values(pcsRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
          });
          localVideoRef.current.srcObject = localStreamRef.current;
        };
      } else {
        Object.values(pcsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
        });
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } catch (e) {
      console.warn("Screen share error:", e);
    }
  }

  function handleAcceptInvite() {
    if (!incomingInvite) return;
    socket.emit("join-room", { roomId: incomingInvite.roomId, username });
    setIncomingInvite(null);
    navigate(`/room/${incomingInvite.roomId}`);
  }

  function handleDeclineInvite() {
    setIncomingInvite(null);
  }

  function leave() {
    socket.emit("leave-room", { roomId, username });
    Object.values(pcsRef.current).forEach((pc) => pc.close());
    pcsRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    navigate("/");
  }

  return (
    <div className="center">
      {incomingInvite && (
        <>
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 999 }} />
          <div
            style={{
              position: "fixed",
              top: "20%",
              left: "50%",
              transform: "translateX(-50%)",
              background: "white",
              padding: "20px",
              border: "2px solid #333",
              borderRadius: "8px",
              zIndex: 1000,
              minWidth: 300,
              textAlign: "center",
            }}
          >
            <p>
              <strong>{incomingInvite.from}</strong> invited you to join room{" "}
              <strong>{incomingInvite.roomId}</strong>
            </p>
            <button onClick={handleAcceptInvite} style={{ marginRight: 10 }}>Accept</button>
            <button onClick={handleDeclineInvite}>Decline</button>
          </div>
        </>
      )}

      <div className="card">
        <h3>Room: {roomId}</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="label">You</div>
            <video ref={localVideoRef} autoPlay muted style={{ width: 240, borderRadius: 8, background: "#000" }} />
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {remoteStreams.map(({ id, stream }) => (
              <div key={id} style={{ position: "relative" }}>
                <div className="label">{id}</div>
                <video
                  autoPlay
                  playsInline
                  muted={mutedRemoteIds.has(id)}
                  style={{ width: 240, borderRadius: 8, background: "#000" }}
                  ref={(el) => { if (el && !el.srcObject) el.srcObject = stream; }}
                />
                <button
                  style={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    zIndex: 10,
                    background: mutedRemoteIds.has(id) ? "red" : "green",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleRemoteMute(id)}
                >
                  {mutedRemoteIds.has(id) ? "Unmute" : "Mute"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={toggleScreenShare}>Share Screen</button>
          <button onClick={toggleMic} style={{ marginLeft: 8 }}>
            {micOn ? "Mute Mic" : "Unmute Mic"}
          </button>
          <button onClick={toggleCam} style={{ marginLeft: 8 }}>
            {camOn ? "Turn Off Camera" : "Turn On Camera"}
          </button>
          <button onClick={leave} style={{ marginLeft: 8 }}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
