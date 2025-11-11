const express = require('express')
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = 3000
const { ObjectId } = require("mongodb");


app.use(cors())
app.use(express.json())



const uri = "mongodb+srv://habituo-db:x4mjgKZyHtClYmb7@cluster0.wtnhlvb.mongodb.net/?appName=Cluster0";



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    await client.connect();
    
    const db = client.db('habituo-db');
    const habitCollection = db.collection('public-habits')
    const usersCollection = db.collection('users');
    const myHabitCollection = db.collection('myhabit');



    app.get('/publicHabits', async(req, res)=>{
      
      const result = await habitCollection.find().toArray();
      
      res.send(result)
    })



     // Get single habit details
    app.get("/publicHabits/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const habit = await habitCollection.findOne({ _id: new ObjectId(id) });
        if (!habit) {
          return res.status(404).send({ message: "Habit not found" });
        }
        res.send(habit);
      } catch (error) {
        console.error("Error fetching habit details:", error);
        res.status(500).send({ message: "Failed to fetch habit details" });
      }
    });



   // post users
    app.post('/users', async (req, res) => {
      const user = req.body;
      if (!user?.email) {
        return res.status(400).send({ message: "Email is required" });
      }

      
      const existing = await usersCollection.findOne({ email: user.email });
      if (existing) {
        return res.send({ message: "User already exists", inserted: false });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });


    // features Habit section
app.get("/featuresHabit", async (req, res) => {
  try {
    const result = await habitCollection
      .find()
      .sort({ createDate: -1 })
      .limit(6)
      .toArray();

    
    res.send(result);
  } catch (error) {
    console.error("Error fetching featured habits:", error);
    res.status(500).send({ message: "Failed to fetch featured habits", error });
  }
});


app.post('/myhabit', async (req, res) => {
      try {
        const habit = req.body;

        if (!habit.habitName || !habit.userEmail) {
          return res.status(400).send({ message: "Habit name and user email required" });
        }

        const result = await myHabitCollection.insertOne(habit);
        res.send({ message: "Habit added successfully", insertedId: result.insertedId });
      } catch (error) {
        console.error("Error adding habit:", error);
        res.status(500).send({ message: "Failed to add habit", error });
      }
    });


    app.get("/myhabit", async (req, res) => {
  const email = req.query.userEmail;
  if (!email) {
    return res.status(400).send({ message: "User email is required" });
  }

  try {
   
    const habits = await myHabitCollection.find({ userEmail: email }).toArray();
    res.send(habits);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch habits", error });
  }
});

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
   
   
  }
}
run().catch(console.dir);





app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})