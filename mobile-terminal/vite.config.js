/** Permite túneles localtunnel (subdominios *.loca.lt cambian en cada sesión). */
export default {
  server: {
    allowedHosts: ['.loca.lt', '.localtunnel.me', 'localhost'],
    host: true,
  },
};
