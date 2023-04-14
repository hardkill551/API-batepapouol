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

const mongoClient = new MongoClient(process.env.DATABASE_URL)
try{
    await mongoClient.connect()
} catch(err){
    console.log(err.message)
}

const db = mongoClient.db()

app.post("/participants", async (req, res)=>{
    const userSchema = joi.object({
        name: joi.string().required()
    })
    const {name} = req.body
    const validation = userSchema.validate({name})

    if(validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const users = await db.collection("participants").find().toArray()

        if(users.find(u => u.name === name)) return res.sendStatus(409)
    
        const user = {name, lastStatus: Date.now()}
        await db.collection("participants").insertOne(user)
        const chatEntry = { from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss") }
        await db.collection("messages").insertOne(chatEntry)
        res.sendStatus(201)

    }   catch (err){
        res.status(500).send(err.message)
    }
    
})
    

app.get("/participants", async (req,res)=>{
    try{
        const users = await db.collection("participants").find().toArray()
        res.send(users)
    } catch(err){
        res.status(500).send(err.message)
    }
    
})

app.post("/messages", async (req, res) =>{
    const {to, text, type} = req.body
    const from = req.headers.user

    try{
        const user = await db.collection("participants").findOne({name: from})
        if(!user) return res.status(422).send("Usuario não existe")

        const userSchema = joi.object({
            to: joi.string().required(),
            text: joi.string().required(),
            type: joi.string().required().valid("message", "private_message"),
            from: joi.string().required()
    })
        
       const messages = {to, text, type, from}
       const validation = userSchema.validate(messages, { abortEarly: false });

        if(validation.error){ 
            const errors = validation.error.details.map((detail) => detail.message);
            return res.status(422).send(errors);
        }
        
        await db.collection("messages").insertOne({...messages, time: dayjs().format("HH:mm:ss")})
        res.sendStatus(201)
    } catch (err){
        res.status(500).send(err.message)
    }
    
})

app.get("/messages", async(req, res)=>{
    const {user} = req.headers
    const {limit} = req.query

    
    try{
        const messages = await db.collection("messages").find({$or: [{from:user}, {to:"Todos"}, {to: user}]}).toArray()
        if(limit===undefined) res.send(messages)
        else if(isNaN(limit)||limit<=0){
            res.sendStatus(422)
        }
        else{
            while(messages.length>limit){
                messages.shift()
            }
            res.send(messages)
        }
    } catch(err){
        res.status(500).send(err.message)
    }

})




app.listen(5000)