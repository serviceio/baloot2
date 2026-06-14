import { io } from "socket.io-client";

// Get current host from window
const getSocketUrl = () => {
    if (typeof window !== "undefined") {
        return window.location.origin;
    }
    return "http://localhost:3000";
};

export const socket = io(getSocketUrl(), { autoConnect: false });
