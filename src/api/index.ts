import dblRouter from '#main/api/routes/dbl.js';
import Logger from '#utils/Logger.js';
import express from 'express';

const app = express();

app.use(express.json());
app.get('/', (req, res) => res.redirect('https://interchat.fun'));
app.use('/dbl', dblRouter);

// run da server
app.listen(process.env.PORT, () =>
  Logger.info(`API listening on http://localhost:${process.env.PORT}`),
);
