import { useState, useEffect } from "react";
import io from "socket.io-client";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";

function App() {
  const [socket, setSocket] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [step, setStep] = useState("lobby");
  const [username, setUsername] = useState("");
  const [roomID, setRoomID] = useState("");
  const [roomData, setRoomData] = useState(null);
  const [lastNumber, setLastNumber] = useState(null);
  const [winner, setWinner] = useState(null);
  const { width, height } = useWindowSize();

  // Initialize socket + listeners once
  useEffect(() => {
    const s = io("https://housyback.onrender.com");
    setSocket(s);

    // debug logs
    s.on("connect", () => console.log("Socket connected:", s.id));
    s.on("connect_error", (err) => console.error("Socket error:", err));

    // event handlers
    const handleRoomData = (data) => {
      setRoomData(data);
      setStep("room");
    };
    const handleNewNumber = ({ number, roomData }) => {
      setLastNumber(number);
      setRoomData(roomData);
    };
    const handleGameOver = ({ number, roomData, username }) => {
      setLastNumber(number);
      setRoomData(roomData);
      setWinner(username);
    };
    const handleGameReset = (newRoom) => {
      setRoomData(newRoom);
      setWinner(null);
      setLastNumber(null);
      setShowPrompt(false);
    };
    const handleError = (msg) => alert(msg);

    // attach
    s.on("room-data", handleRoomData);
    s.on("new-number", handleNewNumber);
    s.on("game-over", handleGameOver);
    s.on("game-reset", handleGameReset);
    s.on("error", handleError);

    // cleanup on unmount
    return () => {
      s.off("connect");
      s.off("connect_error");
      s.off("room-data", handleRoomData);
      s.off("new-number", handleNewNumber);
      s.off("game-over", handleGameOver);
      s.off("game-reset", handleGameReset);
      s.off("error", handleError);
      s.disconnect();
    };
  }, []);

  // prompt delay after win
  useEffect(() => {
    if (!winner) return;
    const t = setTimeout(() => setShowPrompt(true), 5000);
    return () => clearTimeout(t);
  }, [winner]);

  // emit helpers (guard socket)
  const handleCreate = () => {
    if (!username) return alert("Enter your name!");
    if (!socket) return;
    const newID = Math.random().toString(36).slice(2, 8).toUpperCase();
    socket.emit("create-room", { roomID: newID, username });
    setRoomID(newID);
  };
  const handleJoin = () => {
    if (!username || !roomID) return alert("Enter name and Room ID!");
    if (!socket) return;
    socket.emit("join-room", { roomID, username });
  };
  const callNext = () => {
    if (!socket) return;
    socket.emit("generate-number", roomID);
  };

  const allNums = Array.from({ length: 90 }, (_, i) => i + 1);

  if (step === "lobby") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black bg-opacity-50 text-white p-4">
        <h1 className="text-4xl font-extrabold mb-6">🎲 Housie Lobby</h1>
        <input
          className="mb-3 px-3 py-2 rounded text-black"
          placeholder="Your Name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <div className="flex space-x-2">
          <button
            className="px-5 py-2 bg-green-500 hover:bg-green-600 rounded font-semibold"
            onClick={handleCreate}
          >
            Create Room
          </button>
          <input
            className="px-3 py-2 rounded text-black"
            placeholder="Room ID"
            value={roomID}
            onChange={(e) => setRoomID(e.target.value.toUpperCase())}
          />
          <button
            className="px-5 py-2 bg-blue-500 hover:bg-blue-600 rounded font-semibold"
            onClick={handleJoin}
          >
            Join Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen p-6 text-white bg-black bg-opacity-40">
      {winner && <Confetti width={width} height={height} recycle={false} />}
      {winner && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-20">
          <div className="bg-yellow-400 text-black px-8 py-4 rounded-lg text-4xl font-extrabold shadow-xl animate-pulse">
            🏆 {winner} wins! 🏆
          </div>
        </div>
      )}

      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Room: {roomID}</h1>
        <div className="text-2xl">
          Last Called:{" "}
          <span className="underline text-yellow-300">{lastNumber ?? "—"}</span>
        </div>
      </header>

      {!winner && (
        <button
          onClick={callNext}
          className="mb-6 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 rounded-full text-lg font-semibold"
        >
          Call Next Number
        </button>
      )}

      <section className="bg-white bg-opacity-20 p-4 rounded-lg mb-6">
        <h2 className="text-xl mb-3">Called Numbers Board</h2>
        <div className="grid grid-cols-9 gap-1 text-center">
          {allNums.map((n) => {
            const called = roomData?.numbersCalled.includes(n);
            const isWinNum =
              winner &&
              roomData.players
                .find((p) => p.username === winner)
                ?.marks.includes(n);
            return (
              <div
                key={n}
                className={`p-2 rounded ${
                  called ? "bg-green-500 text-white" : "bg-gray-800"
                } ${isWinNum ? "ring-4 ring-yellow-300" : ""}`}
              >
                {n}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Players</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roomData?.players.map((p, idx) => (
            <div
              key={idx}
              className="bg-white bg-opacity-30 p-4 rounded-lg shadow-lg relative"
            >
              <h3 className="text-lg font-bold mb-2">{p.username}</h3>
              <div className="grid grid-cols-5 gap-1 text-center">
                {p.ticket.map((num, i) => {
                  const marked = p.marks.includes(num);
                  return (
                    <div
                      key={i}
                      className={`p-2 rounded ${
                        marked
                          ? "bg-blue-600 text-white"
                          : "bg-gray-300 text-black"
                      }`}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {showPrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-30">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-2xl mb-4">Play again?</h2>
            <div className="space-x-4">
              <button
                className="px-4 py-2 bg-green-500 text-white rounded"
                onClick={() => socket?.emit("reset-game", roomID)}
              >
                Yes
              </button>
              <button
                className="px-4 py-2 bg-red-500 text-white rounded"
                onClick={() => {
                  setStep("lobby");
                  setRoomID("");
                  setRoomData(null);
                  setWinner(null);
                  setLastNumber(null);
                  setShowPrompt(false);
                }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
