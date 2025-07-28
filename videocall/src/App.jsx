import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import {
  Video,
  Mic,
  PhoneOff,
  VideoOff,
  MicOff,
  User,
  AlertCircle,
} from "lucide-react";

// --- Credentials ---
// IMPORTANT: Replace with your actual Agora credentials.
// For production, use a token server instead of a hardcoded token.
const APP_ID = "5d19f71222b54f08b56d5593356cf80d";
const TOKEN =
  "007eJxTYAjT55ugt+D1yuNrT1RWLZ6wMZupoY69ehmP/iX2GTyFwc4KDKYphpZp5oZGRkZJpiZpBhZJpmYppqaWxsamZslpFgYpy5raMxoCGRmybO4xMEIhiM/OEJJaXJKZl87AAAAW/B6N";
const CHANNEL = "Testing";

// Initialize the Agora client. This should be done outside the component
// to prevent re-initialization on every render.
const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

// --- Main App Component ---
function App() {
  const [localTracks, setLocalTracks] = useState([]);
  const [remoteUsers, setRemoteUsers] = useState({});
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);

  // Effect to handle component unmount and clean up resources
  useEffect(() => {
    return () => {
      // This cleanup function runs when the component is about to unmount
      if (client.connectionState === "CONNECTED") {
        handleLeave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // The empty dependency array ensures this effect runs only once on mount and cleanup on unmount

  // Effect to handle Agora client events
  useEffect(() => {
    const handleUserPublished = async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prevUsers) => ({
        ...prevUsers,
        [user.uid]: user,
      }));
    };

    const handleUserLeft = (user) => {
      setRemoteUsers((prevUsers) => {
        const newUsers = { ...prevUsers };
        delete newUsers[user.uid];
        return newUsers;
      });
    };

    client.on("user-published", handleUserPublished);
    client.on("user-left", handleUserLeft);
    client.on("user-unpublished", handleUserLeft);

    return () => {
      client.off("user-published", handleUserPublished);
      client.off("user-left", handleUserLeft);
      client.off("user-unpublished", handleUserLeft);
    };
  }, []);

  const handleJoin = async () => {
    if (!username.trim()) {
      setError("Please enter a name to join.");
      return;
    }
    setError(null); // Clear previous errors

    if (
      client.connectionState === "CONNECTED" ||
      client.connectionState === "CONNECTING"
    ) {
      return;
    }

    setIsJoining(true);
    try {
      await client.join(APP_ID, CHANNEL, TOKEN, username);

      // --- FIX: Handle existing users in the channel ---
      if (client.remoteUsers.length > 0) {
        const existingUsers = {};
        for (const user of client.remoteUsers) {
          existingUsers[user.uid] = user;
          // Subscribe to their tracks
          if (user.hasVideo) {
            await client.subscribe(user, "video");
          }
          if (user.hasAudio) {
            await client.subscribe(user, "audio");
          }
        }
        setRemoteUsers(existingUsers);
      }

      const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
      setLocalTracks(tracks);
      await client.publish(tracks);
      setIsJoined(true);
    } catch (err) {
      console.error("Failed to join the channel", err);
      if (err.code === "NOT_READABLE" || err.name === "NotReadableError") {
        setError(
          "Device in use. Please ensure your camera/microphone are not used by another tab or application."
        );
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    try {
      for (let localTrack of localTracks) {
        localTrack.stop();
        localTrack.close();
      }
      await client.leave();
    } catch (error) {
      console.error("Failed to leave the channel", error);
    }
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
        isJoining={isJoining}
        error={error}
      />
    );
  }

  return (
    <div className="relative flex flex-col h-screen bg-gray-900 text-white font-sans">
      <VideoGrid
        localTracks={localTracks}
        remoteUsers={remoteUsers}
        isVideoMuted={isVideoMuted}
        username={username}
      />
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

// --- UI Sub-components ---

const JoinScreen = ({ username, setUsername, onJoin, isJoining, error }) => (
  <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white px-4 text-center">
    <div className="w-full max-w-sm">
      <h1 className="text-4xl md:text-5xl font-bold mb-4">Video Call</h1>
      <p className="text-gray-400 mb-8">Enter your name to join the channel.</p>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Your Name"
        className="mb-4 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}
      <button
        onClick={onJoin}
        disabled={isJoining}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-70 px-8 py-3 rounded-full shadow-lg transition-transform transform hover:scale-105 w-full font-semibold"
      >
        {isJoining ? "Joining..." : "Join Call"}
      </button>
    </div>
  </div>
);

const VideoGrid = ({ localTracks, remoteUsers, isVideoMuted, username }) => {
  const localVideoTrack = localTracks.find((t) => t.trackMediaType === "video");
  const allUsers = [
    {
      uid: "local",
      videoTrack: localVideoTrack,
      isVideoMuted,
      displayName: username,
    },
    ...Object.values(remoteUsers),
  ];

  const gridLayout = (userCount) => {
    if (userCount === 1) return "grid-cols-1";
    if (userCount === 2) return "grid-cols-1 sm:grid-cols-2";
    if (userCount <= 4) return "grid-cols-2";
    if (userCount <= 9) return "grid-cols-3";
    return "grid-cols-4";
  };

  return (
    <main className="flex-1 p-2 sm:p-4 overflow-hidden">
      <div
        className={`grid gap-2 sm:gap-4 h-full w-full ${gridLayout(
          allUsers.length
        )}`}
      >
        {allUsers.map((user) => (
          <VideoTile
            key={user.uid}
            videoTrack={user.videoTrack}
            // --- FIX: More reliable check for remote user's video state ---
            isMuted={user.uid === "local" ? isVideoMuted : !user.videoTrack}
            displayName={user.uid === "local" ? username : user.uid}
          />
        ))}
      </div>
    </main>
  );
};

const VideoTile = ({ videoTrack, isMuted, displayName }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && videoTrack) {
      videoTrack.play(videoRef.current);
    }
    return () => {
      videoTrack?.stop();
    };
  }, [videoTrack]);

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-md aspect-video">
      <div ref={videoRef} className="w-full h-full" />
      {isMuted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 text-gray-300">
          <User size={48} />
          <span className="mt-2 text-lg font-semibold">{displayName}</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
        {displayName}
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
  <div className="w-full py-4 px-6">
    <div className="max-w-xs mx-auto flex items-center justify-center gap-4">
      <ControlButton
        Icon={isAudioMuted ? MicOff : Mic}
        onClick={onToggleAudio}
        isMuted={isAudioMuted}
        label="Toggle Audio"
      />
      <ControlButton
        Icon={isVideoMuted ? VideoOff : Video}
        onClick={onToggleVideo}
        isMuted={isVideoMuted}
        label="Toggle Video"
      />
      <ControlButton
        Icon={PhoneOff}
        onClick={onLeave}
        isHangUp
        label="Leave Call"
      />
    </div>
  </div>
);

const ControlButton = ({ Icon, onClick, isMuted, isHangUp = false, label }) => {
  const baseClasses =
    "p-4 rounded-full transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900";

  const colorClasses =
    isHangUp || isMuted
      ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
      : "bg-gray-700 hover:bg-gray-600 focus:ring-gray-500";

  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`${baseClasses} ${colorClasses}`}
    >
      <Icon size={24} className="text-white" />
    </button>
  );
};

export default App;
