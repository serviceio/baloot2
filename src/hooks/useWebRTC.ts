import { useEffect, useRef, useState } from "react";
import { socket } from "../socket";

export function useWebRTC(localStream: MediaStream | null) {
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  useEffect(() => {
    if (!localStream) {
        Object.values(peersRef.current).forEach(p => (p as RTCPeerConnection).close());
        peersRef.current = {};
        setRemoteStreams({});
        return;
    }

    socket.emit("voice-ready");

    socket.on("user-voice-ready", async (userId: string) => {
        peersRef.current[userId] = createPeer(userId, true);
    });

    socket.on("voice-offer", async ({ from, offer }) => {
        const peer = createPeer(from, false);
        peersRef.current[from] = peer;
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("voice-answer", { to: from, answer });
    });

    socket.on("voice-answer", async ({ from, answer }) => {
        const peer = peersRef.current[from];
        if (peer) {
            await peer.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    socket.on("voice-ice-candidate", async ({ from, candidate }) => {
        const peer = peersRef.current[from];
        if (peer && candidate) {
            await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
        }
    });

    return () => {
      socket.off("user-voice-ready");
      socket.off("voice-offer");
      socket.off("voice-answer");
      socket.off("voice-ice-candidate");
    };
  }, [localStream]);

  const createPeer = (userId: string, isInitiator: boolean) => {
      const peer = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      if (localStream) {
          localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
      }

      peer.onicecandidate = (event) => {
          if (event.candidate) {
              socket.emit("voice-ice-candidate", { to: userId, candidate: event.candidate });
          }
      };

      peer.ontrack = (event) => {
          setRemoteStreams(prev => ({
              ...prev,
              [userId]: event.streams[0]
          }));
      };

      peer.onnegotiationneeded = async () => {
          if (isInitiator) {
              try {
                 const offer = await peer.createOffer();
                 await peer.setLocalDescription(offer);
                 socket.emit("voice-offer", { to: userId, offer });
              } catch (e) {
                 console.error("Negotiation error:", e);
              }
          }
      };

      return peer;
  };

  return { remoteStreams };
}
