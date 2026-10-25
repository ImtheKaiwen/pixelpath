function initialUpdateState(currentVersion) {
  return {
    state: "idle",
    percent: 0,
    currentVersion,
    availableVersion: null,
  };
}

function reduceUpdateState(previous, event) {
  switch (event.type) {
    case "checking":
      return { ...previous, state: "checking", message: undefined };
    case "available":
      return {
        ...previous,
        state: "available",
        percent: 0,
        availableVersion: event.version,
        releaseNotes: event.releaseNotes || "",
        message: undefined,
      };
    case "none":
      return { ...previous, state: "idle", percent: 0, message: undefined };
    case "download-started":
      if (previous.state !== "available") return previous;
      return { ...previous, state: "downloading", percent: 0 };
    case "progress":
      if (previous.state !== "downloading") return previous;
      return {
        ...previous,
        percent: Math.max(0, Math.min(100, Math.round(event.percent || 0))),
      };
    case "downloaded":
      return {
        ...previous,
        state: "downloaded",
        availableVersion: event.version || previous.availableVersion,
        percent: 100,
      };
    case "error":
      return { ...previous, state: "error", message: event.message };
    default:
      return previous;
  }
}

module.exports = { initialUpdateState, reduceUpdateState };
