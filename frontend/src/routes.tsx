import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";
import { RequireAuth } from "./lib/auth/RequireAuth";

import LoginPage from "./features/auth/pages/LoginPage";
import RegisterPage from "./features/auth/pages/RegisterPage";
import EmailConfirmPage from "./features/auth/pages/EmailConfirmPage";
import SubjectsPage from "./features/subjects";
import TimerPage from "./features/timer";
import DocumentsPage from "./features/documents";
import QuizPage from "./features/quiz";
import StudyPlanPage from "./features/study-plan";
import NotebooksPage from "./features/notebooks";
import NotebookDetailPage from "./features/notebooks/detail";
import ChatPage from "./features/chat";
import DashboardPage from "./features/dashboard";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/auth/email/confirm", element: <EmailConfirmPage /> },
  {
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    children: [
      { path: "/", element: <Navigate to="/dashboard" replace /> },
      { path: "/subjects", element: <SubjectsPage /> },
      { path: "/timer", element: <TimerPage /> },
      { path: "/documents", element: <DocumentsPage /> },
      { path: "/quiz", element: <QuizPage /> },
      { path: "/study-plan", element: <StudyPlanPage /> },
      { path: "/notebooks", element: <NotebooksPage /> },
      { path: "/notebooks/:id", element: <NotebookDetailPage /> },
      { path: "/chat", element: <ChatPage /> },
      { path: "/dashboard", element: <DashboardPage /> },
    ],
  },
]);
