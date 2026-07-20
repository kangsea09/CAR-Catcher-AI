import { Outlet } from "react-router";

export const AppLayout = () => {
  return (
    <main className="min-h-screen w-full">
      <Outlet />
    </main>
  );
};
