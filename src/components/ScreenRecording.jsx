import { useState, useRef } from "react";

function ScreenRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [filename, setFilename] = useState(`recording-${Date.now()}.webm`);
  const previewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const combinedStreamRef = useRef(null);

  function combineStreams(screenStream, micStream) {
    const hasScreenAudio = screenStream.getAudioTracks().length > 0;
    const hasMic = micStream && micStream.getAudioTracks().length > 0;

    if (!hasScreenAudio && !hasMic) return { combined: screenStream, audioContext: null };

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    if (hasScreenAudio) {
      try {
        const src1 = audioContext.createMediaStreamSource(screenStream);
        src1.connect(destination);
      } catch (e) {
        console.warn("Screen audio error:", e);
      }
    }
    if (hasMic) {
      try {
        const src2 = audioContext.createMediaStreamSource(micStream);
        src2.connect(destination);
      } catch (e) {
        console.warn("Mic audio error:", e);
      }
    }

    const combined = new MediaStream();
    screenStream.getVideoTracks().forEach((t) => combined.addTrack(t));
    destination.stream.getAudioTracks().forEach((t) => combined.addTrack(t));

    return { combined, audioContext };
  }

  async function startRecording() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        console.warn("Mic not available:", e);
      }

      const { combined, audioContext } = combineStreams(screenStream, micStream);
      combinedStreamRef.current = combined;
      audioContextRef.current = audioContext;

      if (previewRef.current) {
        previewRef.current.srcObject = screenStream;
        previewRef.current.muted = true;
        await previewRef.current.play().catch(() => {});
      }

      let options = {};
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
        options.mimeType = "video/webm;codecs=vp9,opus";
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
        options.mimeType = "video/webm;codecs=vp8,opus";
      } else {
        options.mimeType = "video/webm";
      }

      const recorder = new MediaRecorder(combined, options);
      mediaRecorderRef.current = recorder;
      const localChunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) localChunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(localChunks, { type: recorder.mimeType });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setIsRecording(false);

        combined.getTracks().forEach((t) => t.stop());
        if (audioContextRef.current) {
          try { audioContextRef.current.close(); } catch {}
        }
      };

      recorder.start(1000);
      setIsRecording(true);
    } catch (err) {
      alert("Error starting recording: " + err.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  return (
    <>
    {/* <VideoRoom/> */}
    <div className="container py-5">
      <div className="card shadow-lg border-0" style={{ borderRadius: "15px" }}>
        <div className="card-header text-white" style={{
          background: "linear-gradient(135deg, #6a11cb, #2575fc)",
          borderTopLeftRadius: "15px",
          borderTopRightRadius: "15px"
        }}>
          <h3 className="mb-0 text-center">🎥 React Screen Recorder</h3>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label fw-bold">Filename</label>
            <input
              type="text"
              className="form-control"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
          </div>

          <div className="d-flex gap-2 mb-3">
            {!isRecording ? (
              <button onClick={startRecording} className="btn btn-success flex-fill fw-bold">
                ⏺ Start Recording
              </button>
            ) : (
              <button onClick={stopRecording} className="btn btn-danger flex-fill fw-bold">
                ⏹ Stop Recording
              </button>
            )}

            {downloadUrl && (
              <a href={downloadUrl} download={filename} className="flex-fill">
                <button className="btn btn-primary w-100 fw-bold">
                  ⬇ Download
                </button>
              </a>
            )}
          </div>

          <h5 className="mt-4">Live Preview</h5>
          <video ref={previewRef} className="w-100 border rounded" style={{ background: "#000", maxHeight: "300px" }} controls />

          <h5 className="mt-4">Recorded Playback</h5>
          {downloadUrl ? (
            <video src={downloadUrl} className="w-100 border rounded" style={{ background: "#000" }} controls />
          ) : (
            <div className="text-muted">No recording yet.</div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default ScreenRecording;
