// router.tsx
import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./layout";
import Analyze from "./pages/Analyze";
import Main from "./pages/Main";

export const Router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: (
      <div className="flex min-h-screen items-center justify-center bg-[#061523] text-[#c9d4e5]">
        페이지를 불러오는 중 오류가 발생했습니다.
      </div>
    ),
    children: [
      {
        path: "/",
        element: <Main />,
      },
      {
        path: "/analyze",
        element: <Analyze />,
      },
    ],
  },
]);
