import { io } from "socket.io-client";
const socket = io("https://obsbackend.onrender.com");
export default socket;
