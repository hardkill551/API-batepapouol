import express from "express";
import {MongoClient} from "mongodb"
import cors from "cors"
import dotenv from "dotenv"
import joi from "joi"
import dayjs from "dayjs";

const app = express()
app.use(express.json())
app.use(cors())
dotenv.config(  )

let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
.then(()=> db = mongoClient.db())
.catch(err=> console.log(err.message))

app.post("/participants", (req, res)=>{
    const userSchema = joi.object({
        name: joi.string().required()
    })
    const {name} = req.body
    const validation = userSchema.validate({name})

    if(validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    db.collection("users").find().toArray()
    .then(users => {
        if(users.find(u => u.name === name)) return res.sendStatus(409)
        else{
            const user = {name, lastStatus: Date.now()}
            db.collection("users").insertOne(user)
            .then(()=> {
                const chatEntry = { from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss") }
                db.collection("messages").insertOne(chatEntry)
                .then(()=>res.sendStatus(201))
                .catch(err=>res.status(500).send(err.message))
            })
            .catch(err=> res.status(500).send(err))
            
        }
    })
    .catch(err => res.status(500).send(err))
    
})

app.get("/participants",(req,res)=>{
    db.collection("users").find().toArray()
        .then(users => res.send(users))
        .catch(err => res.status(500).send(err.message))
})



app.listen(5000)