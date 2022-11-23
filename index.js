const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.send("Doctors portal server is running");
});
//connecting MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.wxeycza.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
//verify JWT

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("Unauthorized access");
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send("Forbidden Access");
    }
    req.decoded = decoded;
    next();
  });
}
//async function
async function run() {
  try {
    const appointmentsOptionsCollection = client
      .db("Dcotors-portal")
      .collection("appointments");
    const BookingCollection = client
      .db("Dcotors-portal")
      .collection("bookings");
    const usersCollection = client.db("Dcotors-portal").collection("users");
    const doctorsCollection = client.db("Dcotors-portal").collection("doctors");

    //verify admin via a middleware-make sure this function run after verify JWT function so that you can check the decoded email;

    const verifyAdmin = async (req, res, next) => {
      console.log("inside verify admin", req.decoded.email);
      const decodedEmail = req.decoded.email;
      console.log(decodedEmail, "now");
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };
    //use aggregate to query multiple elements and merge result.
    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      console.log(date);
      const query = {};
      const options = await appointmentsOptionsCollection.find(query).toArray();
      //get the booking of the provided date
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await BookingCollection.find(
        bookingQuery
      ).toArray();
      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlots = optionBooked.map((book) => book.slot);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
      });
      res.send(options);
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "30D",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment,
      };
      const alreadyBooked = await BookingCollection.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `You already have a booking on ${booking.appointmentDate}`;
        return res.send({ acknowledged: false, message });
      }
      const result = await BookingCollection.insertOne(booking);
      res.send(result);
    });
    //get allbooking

    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log("email", email);
      const decodedEmail = req.decoded.email;
      console.log(decodedEmail, "Lower");
      if (email !== decodedEmail.toLowerCase()) {
        console.log("error from bookings");
        return res.status(403).send({ message: "forbidden access" });
      }
      console.log("TOken", req.headers.authorization);
      const query = {
        email: email,
      };
      const bookings = await BookingCollection.find(query).toArray();
      res.send(bookings);
    });
    //get users
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      console.log(email, "admin");
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //appointment speciality  get
    app.get("/appointmentSpeciality", async (req, res) => {
      const query = {};
      const result = await appointmentsOptionsCollection
        .find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
    });
    //api for doctor collection

    app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    });
    app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const doctors = await doctorsCollection.find(query).toArray();
      res.send(doctors);
    });

    app.delete("/doctors/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await doctorsCollection.deleteOne(query);
      res.send(result);
    });
    //temporary system to update price field on appointment options

    app.get('/addprice',async(req,res)=>{
      const filter = {};
      const options = {upsert:true};
      const updatedDoc = {
        $set:{
          price: 99
        }
      };
      const result =await appointmentsOptionsCollection.updateMany(filter,updatedDoc,options)
    res.send(result)
    });
//get bookings specific id
app.get('/bookings/:id',async(req,res)=>{
  const id = req.params.id;
  const query = {_id: ObjectId(id)};
  const booking = await BookingCollection.findOne(query);
  res.send(booking)
})
  } finally {
  }
}
run().catch((e) => console.log(e));

app.listen(port, () => {
  console.log("server is running", port);
});
