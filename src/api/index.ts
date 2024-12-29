import dblRouter from '#main/api/routes/dbl.js';
import Logger from '#utils/Logger.js';
import express from 'express';

const app = express();

app.use(express.json());
app.get('/', (req, res) => res.redirect('https://interchat.tech'));
app.use('/dbl', dblRouter);

// run da server
export const startApi = () =>
  app.listen(process.env.PORT, () =>
    Logger.info(`API listening on http://localhost:${process.env.PORT}`),
  );
