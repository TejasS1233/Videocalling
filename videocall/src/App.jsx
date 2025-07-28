import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { Video, Mic, PhoneOff, VideoOff, MicOff, User } from "lucide-react";
import "./App.css"; // Assuming you have a CSS file for styles
const APP_ID = "YOUR APP ID HERE"; // Replace with your Agora App ID
const TOKEN = "YOUR TOKEN HERE"; // Replace with your Agora token
const CHANNEL = "YOUR CHANNEL NAME HERE"; // Replace with your channel name

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

function App() {
  const [localTracks, setLocalTracks] = useState([]);
  const [remoteUsers, setRemoteUsers] = useState({});
  const [isJoined, setIsJoined] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const handleUserPublished = async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prev) => ({
        ...prev,
        [user.uid]: { ...user, displayName: user.uid },
      }));
      if (mediaType === "video" && user.videoTrack) {
        user.videoTrack.play(`remote-${user.uid}`);
      }
      if (mediaType === "audio" && user.audioTrack) {
        user.audioTrack.play();
      }
    };

    const handleUserUnpublished = (user, mediaType) => {
      if (mediaType === "video" && user.videoTrack) user.videoTrack.stop();
      if (mediaType === "audio" && user.audioTrack) user.audioTrack.stop();
    };

    const handleUserLeft = (user) => {
      setRemoteUsers((prev) => {
        const updated = { ...prev };
        delete updated[user.uid];
        return updated;
      });
    };

    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);
    client.on("user-left", handleUserLeft);

    return () => {
      client.off("user-published", handleUserPublished);
      client.off("user-unpublished", handleUserUnpublished);
      client.off("user-left", handleUserLeft);
    };
  }, []);

  const handleJoin = async () => {
    if (!username.trim()) return alert("Please enter a name!");
    await client.join(APP_ID, CHANNEL, TOKEN, username);
    const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
    setLocalTracks(tracks);
    await client.publish(tracks);
    setIsJoined(true);
  };

  const handleLeave = async () => {
    localTracks.forEach((track) => {
      track.stop();
      track.close();
    });
    await client.leave();
    setLocalTracks([]);
    setRemoteUsers({});
    setIsJoined(false);
  };

  const toggleAudio = async () => {
    const audioTrack = localTracks.find((t) => t.trackMediaType === "audio");
    if (audioTrack) {
      const newState = !isAudioMuted;
      await audioTrack.setMuted(newState);
      setIsAudioMuted(newState);
    }
  };

  const toggleVideo = async () => {
    const videoTrack = localTracks.find((t) => t.trackMediaType === "video");
    if (videoTrack) {
      const newState = !isVideoMuted;
      await videoTrack.setMuted(newState);
      setIsVideoMuted(newState);
    }
  };

  if (!isJoined) {
    return (
      <JoinScreen
        username={username}
        setUsername={setUsername}
        onJoin={handleJoin}
      />
    );
  }

  return (
    <div className="relative flex flex-col h-screen bg-gray-900 text-white font-sans">
      {/* Video Grid */}
      <VideoGrid
        localTracks={localTracks}
        remoteUsers={remoteUsers}
        isVideoMuted={isVideoMuted}
        username={username}
      />

      {/* Floating Control Bar */}
      <ControlBar
        onLeave={handleLeave}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
      />
    </div>
  );
}

const JoinScreen = ({ username, setUsername, onJoin }) => (
  <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white px-4 text-center">
    <h1 className="text-4xl font-bold mb-4">Video Call</h1>
    <input
      type="text"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      placeholder="Enter your name"
      className="mb-6 px-4 py-2 rounded-lg text-black w-full max-w-xs"
    />
    <button
      onClick={onJoin}
      className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-full shadow-md transition-transform transform hover:scale-105 w-full max-w-xs"
    >
      Join Call
    </button>
  </div>
);

const VideoGrid = ({ localTracks, remoteUsers, isVideoMuted, username }) => {
  const localVideoTrack = localTracks.find((t) => t.trackMediaType === "video");
  const users = [
    {
      uid: "local",
      videoTrack: localVideoTrack,
      muted: isVideoMuted,
      displayName: username,
    },
    ...Object.values(remoteUsers),
  ];

  const gridCols =
    users.length === 1
      ? "grid-cols-1"
      : users.length === 2
      ? "grid-cols-2"
      : users.length <= 4
      ? "grid-cols-2 md:grid-cols-2"
      : "grid-cols-3";

  return (
    <main className="flex-1 p-2 sm:p-4">
      <div className={`grid gap-2 sm:gap-4 h-full w-full ${gridCols}`}>
        {users.map((user) => (
          <VideoTile key={user.uid} user={user} />
        ))}
      </div>
    </main>
  );
};

const VideoTile = ({ user }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (user.uid === "local" && user.videoTrack && videoRef.current) {
      user.videoTrack.play(videoRef.current);
    }
  }, [user.videoTrack]);

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-md aspect-video">
      {user.uid === "local" ? (
        <div ref={videoRef} className="w-full h-full" />
      ) : (
        <div id={`remote-${user.uid}`} className="w-full h-full" />
      )}
      {user.muted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 text-gray-300">
          <User size={48} />
          <span className="mt-2 text-lg">{user.displayName || user.uid}</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-sm">
        {user.displayName || user.uid}
      </div>
    </div>
  );
};

const ControlBar = ({
  onLeave,
  onToggleAudio,
  onToggleVideo,
  isAudioMuted,
  isVideoMuted,
}) => (
  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4 bg-gray-800 bg-opacity-80 px-6 py-3 rounded-full shadow-lg">
    <ControlButton
      Icon={isAudioMuted ? MicOff : Mic}
      onClick={onToggleAudio}
      isMuted={isAudioMuted}
    />
    <ControlButton
      Icon={isVideoMuted ? VideoOff : Video}
      onClick={onToggleVideo}
      isMuted={isVideoMuted}
    />
    <ControlButton Icon={PhoneOff} onClick={onLeave} isHangUp />
  </div>
);

const ControlButton = ({ Icon, onClick, isMuted, isHangUp }) => {
  const baseClasses = "p-4 rounded-full transition transform hover:scale-110";
  const colors = isHangUp
    ? "bg-red-600 hover:bg-red-700"
    : isMuted
    ? "bg-red-500 hover:bg-red-600"
    : "bg-gray-700 hover:bg-gray-600";
  return (
    <button onClick={onClick} className={`${baseClasses} ${colors}`}>
      <Icon size={24} className="text-white" />
    </button>
  );
};

export default App;
