const express = require('express')
const app = express();
require('dotenv').config();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = 3000
const { ObjectId } = require("mongodb");


app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.wtnhlvb.mongodb.net/?appName=Cluster0`;





const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // await client.connect();
    
    const db = client.db('habituo-db');
    const habitCollection = db.collection('public-habits')
    const usersCollection = db.collection('users');
    const myHabitCollection = db.collection('myhabit');



    app.get('/publicHabits', async (req, res) => {
  try {
    const result = await habitCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching public habits:", error);
    res.status(500).send({ message: "Failed to fetch public habits", error });
  }
});



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



// public -> myhabit sync when marking complete
app.patch("/publicHabits/:id/markComplete", async (req, res) => {
  const { id } = req.params;
  const { userEmail } = req.body;
  const today = new Date().toISOString().split("T")[0];

  try {
    const publicHabit = await habitCollection.findOne({ _id: new ObjectId(id) });
    if (!publicHabit) return res.status(404).send({ message: "Habit not found" });

    const completionHistory = publicHabit.completionHistory || [];
    if (completionHistory.some(e => e.date === today && e.userEmail === userEmail)) {
      return res.status(400).send({ message: "Already marked complete today" });
    }

    const newEntry = { date: today, userEmail };

    // push into public-habits
    await habitCollection.updateOne(
      { _id: publicHabit._id },
      { $push: { completionHistory: newEntry } }
    );

 
    await myHabitCollection.updateMany(
      { publicHabitId: publicHabit._id },
      { $push: { completionHistory: newEntry } }
    );

  
    const updatedPublic = await habitCollection.findOne({ _id: publicHabit._id });

    res.send({
      message: "Marked complete and synced to linked MyHabits",
      completionHistory: updatedPublic.completionHistory || []
    });
  } catch (err) {
    console.error("public markComplete error:", err);
    res.status(500).send({ message: "Failed to mark complete", error: err.message || err });
  }
});



app.patch("/publicHabits/:id", async (req, res) => {
  const id = req.params.id;
  const updates = req.body;

  try {
    const publicHabit = await habitCollection.findOne({ _id: new ObjectId(id) });
    if (!publicHabit) return res.status(404).send({ message: "Public habit not found" });

  
    await habitCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    
    await myHabitCollection.updateMany(
      { publicHabitId: publicHabit._id },
      { $set: updates }
    );

    res.send({ message: "Updated in PublicHabits (and synced to MyHabit where linked)" });
  } catch (error) {
    console.error("Error updating PublicHabit:", error);
    res.status(500).send({ message: "Update failed", error });
  }
});







app.patch("/syncMarkComplete/:id", async (req, res) => {
  const { id } = req.params;
  const { userEmail } = req.body;
  const today = new Date().toISOString().split("T")[0];

  try {
    const myHabit = await myHabitCollection.findOne({ _id: new ObjectId(id) });
    if (!myHabit) return res.status(404).send({ message: "MyHabit not found" });

    const alreadyDone = myHabit.completionHistory?.some(entry => entry.date === today);
    if (alreadyDone) return res.status(400).send({ message: "Already marked today" });

    const newEntry = { userEmail, date: today };

    //  MyHabit update
    await myHabitCollection.updateOne(
      { _id: new ObjectId(id) },
      { $push: { completionHistory: newEntry } }
    );

    //  PublicHabit update if linked
    if (myHabit.publicHabitId) {
      await habitCollection.updateOne(
        { _id: new ObjectId(myHabit.publicHabitId) },
        { $push: { completionHistory: newEntry } }
      );
    }

    //  Full updated MyHabit object fetch করে return
    const updatedHabit = await myHabitCollection.findOne({ _id: new ObjectId(id) });

    res.send(updatedHabit);  // ⚠ এখানে full habit object পাঠানো হচ্ছে
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to mark complete", error: err });
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

// Add a new habit (auto-link to public-habits if same name exists)
app.post('/myhabit', async (req, res) => {
  try {
    const habit = req.body;

    if (!habit.habitName || !habit.userEmail) {
      return res.status(400).send({ message: "Habit name and user email required" });
    }

    // 🔹 Try to link automatically if the name matches a public habit
    const existingPublic = await habitCollection.findOne({ habitName: habit.habitName });
    if (existingPublic) {
      habit.publicHabitId = existingPublic._id;
    }

    const result = await myHabitCollection.insertOne(habit);
    res.send({ message: "Habit added successfully", insertedId: result.insertedId });
  } catch (error) {
    console.error("Error adding habit:", error);
    res.status(500).send({ message: "Failed to add habit", error });
  }
});



    // Add new habit to public-habits collection
app.post('/publicHabits', async (req, res) => {
  try {
    const habit = req.body;

    if (!habit.habitName || !habit.creatorName) {
      return res.status(400).send({ message: "Habit name and creator required" });
    }

    const result = await habitCollection.insertOne(habit);
    res.send({ message: "Habit added to public-habits successfully", insertedId: result.insertedId });
  } catch (error) {
    console.error("Error adding habit to public-habits:", error);
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



// Delete habit by ID
app.delete("/myhabit/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await myHabitCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Habit not found" });
    }
    res.send({ message: "Habit deleted successfully", deletedId: id });
  } catch (error) {
    console.error("Error deleting habit:", error);
    res.status(500).send({ message: "Failed to delete habit", error });
  }
});



// get single myhabit
app.get("/myhabit/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const habit = await myHabitCollection.findOne({ _id: new ObjectId(id) });
    if (!habit) return res.status(404).send({ message: "Habit not found" });
    res.send(habit);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch habit" });
  }
});


app.patch("/myhabit/:id", async (req, res) => {
  const id = req.params.id;
  const updates = req.body;

  try {
    const habit = await myHabitCollection.findOne({ _id: new ObjectId(id) });
    if (!habit) return res.status(404).send({ message: "Habit not found" });

    await myHabitCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (habit.publicHabitId) {
      await habitCollection.updateOne(
        { _id: new ObjectId(habit.publicHabitId) },
        { $set: updates }
      );
    }

    const updatedHabit = await myHabitCollection.findOne({ _id: new ObjectId(id) });
    res.send(updatedHabit);
  } catch (error) {
    console.error("Error updating habit:", error);
    res.status(500).send({ message: "Failed to update habit", error });
  }
});








    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
   
   
  }
}
run().catch(console.dir);





app.get('/', (req, res) => {
  res.send('Hello World!')
})

module.exports = app;