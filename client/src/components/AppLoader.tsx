import { Loader } from '@mantine/core';

export function AppLoader() {
  return (
    <div className="fixed inset-0 z-9999 flex min-h-screen w-screen items-center justify-center bg-bg">
      <Loader color="var(--accent)" size={50} />
    </div>
  );
}
