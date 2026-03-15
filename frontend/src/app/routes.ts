import { createElement } from "react";
import { createBrowserRouter } from "react-router";
import { AppShell } from "./components/layout/AppShell";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";

function lazyRoute<TModule extends Record<string, unknown>, TKey extends keyof TModule & string>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return async () => ({
    Component: (await loader())[exportName] as React.ComponentType,
  });
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppShell,
    errorElement: createElement(RouteErrorBoundary),
    children: [
      {
        index: true,
        lazy: lazyRoute(() => import("./pages/SystemStatus"), "SystemStatus"),
      },
      {
        path: "camera-setup",
        lazy: lazyRoute(() => import("./pages/CameraSetup"), "CameraSetup"),
      },
      {
        path: "motor-setup",
        lazy: lazyRoute(() => import("./pages/MotorSetup"), "MotorSetup"),
      },
      {
        path: "teleop",
        lazy: lazyRoute(() => import("./pages/Teleop"), "Teleop"),
      },
      {
        path: "record",
        lazy: lazyRoute(() => import("./pages/Recording"), "Recording"),
      },
      {
        path: "dataset",
        lazy: lazyRoute(() => import("./pages/DatasetManagement"), "DatasetManagement"),
      },
      {
        path: "train",
        lazy: lazyRoute(() => import("./pages/Training"), "Training"),
      },
      {
        path: "eval",
        lazy: lazyRoute(() => import("./pages/Evaluation"), "Evaluation"),
      },
    ],
  },
]);
