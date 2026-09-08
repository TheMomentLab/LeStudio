
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { APP_NAME } from "./app/profile";

  document.title = APP_NAME;

  createRoot(document.getElementById("root")!).render(<App />);
  