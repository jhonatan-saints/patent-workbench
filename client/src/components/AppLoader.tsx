import { Loader } from '@mantine/core';

export function AppLoader() {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      zIndex: 9999,
      position: 'fixed',
      left: 0,
      top: 0,
    }}>
      <Loader color="var(--accent)" size={50} />
    </div>
  );
}
