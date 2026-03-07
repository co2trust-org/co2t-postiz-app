const defaultBackendUrl = '/api';

const normalizeConfiguredBackendUrl = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return defaultBackendUrl;
  }

  // Avoid generating protocol-relative URLs (e.g. `//auth/register`) in fetch calls.
  if (trimmed === '/') {
    return defaultBackendUrl;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export const resolvePublicBackendUrl = () => {
  const configuredValue = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!configuredValue) {
    return defaultBackendUrl;
  }

  const configured = normalizeConfiguredBackendUrl(configuredValue);
  if (configured.startsWith('/')) {
    return configured;
  }

  try {
    const configuredUrl = new URL(configured);
    const frontendUrl = process.env.FRONTEND_URL
      ? new URL(process.env.FRONTEND_URL)
      : null;

    const isFrontendHostRoot =
      frontendUrl &&
      configuredUrl.host === frontendUrl.host &&
      (configuredUrl.pathname === '' || configuredUrl.pathname === '/');

    // If accidentally pointed to the public frontend root, route through Next rewrite.
    if (isFrontendHostRoot) {
      return defaultBackendUrl;
    }
  } catch {
    return defaultBackendUrl;
  }

  return configured;
};
