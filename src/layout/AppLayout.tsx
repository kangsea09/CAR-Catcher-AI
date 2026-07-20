import { Outlet } from "react-router";

export const AppLayout = () => {
  return (
    <main className="w-full mt-[70px]">
      <Outlet />
    </main>
  );
};
