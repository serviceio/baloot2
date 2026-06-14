import React, { useEffect, useRef } from "react";

export function AudioPlayer({ stream, key }: { stream: MediaStream, key?: string | number }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current && stream) {
            audioRef.current.srcObject = stream;
            
            const playStream = () => {
                if (audioRef.current) {
                    audioRef.current.play().catch(e => {
                        console.error("Audio playback failed on mobile. Requires user interaction.", e);
                    });
                }
            };

            playStream();

            // Mobile browsers often block autoplay until a physical interaction
            window.addEventListener('click', playStream, { once: true });
            window.addEventListener('touchstart', playStream, { once: true });

            return () => {
                window.removeEventListener('click', playStream);
                window.removeEventListener('touchstart', playStream);
            }
        }
    }, [stream]);

    return <audio ref={audioRef} autoPlay playsInline muted={false} style={{ display: "none" }} />;
}
