import 'dotenv/config';import {app} from './app.js';import {connectDB} from './config/db.js';
await connectDB();const port=Number(process.env.PORT)||5000;app.listen(port,()=>console.log(`ViArena API listening on http://localhost:${port}`));
