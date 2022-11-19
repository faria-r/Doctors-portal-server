const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json())

app.get('/',async(req,res)=>{
    res.send('Doctors portal server is running')
})
//connecting MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.wxeycza.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//async function
async function run(){
    try{
const appointmentsOptionsCollection = client.db('Dcotors-portal').collection('appointments');
const BookingCollection = client.db('Dcotors-portal').collection('bookings');
//use aggregate to query multiple elements and merge result.
app.get('/appointmentOptions',async(req,res)=>{
    const date= req.query.date;
    console.log(date)
    const query = {};
    const options = await appointmentsOptionsCollection.find(query).toArray();
    //get the booking of the provided date
    const bookingQuery = {appointmentDate: date}
    const alreadyBooked = await BookingCollection.find(bookingQuery).toArray();
    options.forEach(option =>{
        const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
        const bookedSlots = optionBooked.map(book => book.slot);
        const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot) );
        option.slots = remainingSlots;
    })
    res.send(options)
});

 app.post('/bookings',async(req,res)=>{
    const booking = req.body;
    const query = {
        appointmentDate:booking.appointmentDate,
        email:booking.email,
        treatment: booking.treatment
    }
    const alreadyBooked = await BookingCollection.find(query).toArray();
    if(alreadyBooked.length){
        const message = `You already have a booking on ${booking.appointmentDate}`
        return res.send({acknowledged: false,message})
    }
    const result = await BookingCollection.insertOne(booking);
    res.send(result)
 })
    }
    finally{

    }
}
run().catch(e => console.log(e))

app.listen(port,()=>{console.log('server is running',port)})