import { createApp } from "vue";
import App from "./App.vue";
import "./index.css";

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app element");

createApp(App).mount(container);
