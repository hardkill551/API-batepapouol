import express from "express";
import {MongoClient} from "mongodb"
import cors from "cors"
import dotenv from "dotenv"

const app = express()
app.use(express.json())
app.use(cors())
dotenv.config(  )

let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
.then(()=> db = mongoClient.db())
.catch(err=> console.log(err.message))





app.listen(5000)