import express from "express";
import {MongoClient, ObjectId} from "mongodb"
import cors from "cors"
import dotenv from "dotenv"
import joi from "joi"
import dayjs from "dayjs";
import { stripHtml } from "string-strip-html";

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
    const name = stripHtml(req.body.name).result.trim()
    const validation = userSchema.validate(req.body)
    
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
    const from = req.headers.user
    const to = stripHtml(req.body.to).result.trim()
    const text = stripHtml(req.body.text).result.trim()
    const type = stripHtml(req.body.type).result.trim()
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

app.post("/status", async(req, res)=>{
    const {user} = req.headers
    if(!user) return res.sendStatus(404)
    try{
        const participant = await db.collection("participants").findOne({name: user})
        if(!participant) return res.sendStatus(404)
        await db.collection("participants").updateOne({name: user},{$set: {lastStatus: Date.now()}})
        res.sendStatus(200)
    }   catch(err){
        res.status(500).send(err.message)
    }
    
})

app.delete("messages/:ID_DA_MENSAGEM", async (req, res)=>{
    const {user} = req.headers
    const {id} = req.params
    try{
        const message = await db.collection("/messages").findOne({_id: new ObjectId(id)})
        if(!message) return res.sendStatus(404)
        if(message.from !== user) return res.sendStatus(401)
        db.collection("/messages").deleteOne({_id: new ObjectId(id)})
    } catch(err){
        res.status(500).send(err.message)
    }
})



setInterval(async ()=>{
    const usersToDelete = await db.collection("participants").find({lastStatus: {$lt: Date.now()-10000}}).toArray()
    while(usersToDelete.length>0){
    await db.collection("participants").deleteOne({_id: usersToDelete[0]._id})
    await db.collection("messages").insertOne(
        { 
            from: usersToDelete[0].name,
            to: 'Todos',
            text: 'sai da sala...',
            type: 'status',
            time: dayjs().format("HH:mm:ss")
        }
    )
    usersToDelete.shift()
}
}, 15000)

app.listen(5000)