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






    // dashboard (admin/user) check

app.get('/users/:email', async (req, res) => {
  const email = req.params.email;
  const query = { email: email };
  try {
    const user = await usersCollection.findOne(query);
    if (user) {
      res.send(user);
    } else {
      
      res.send({ role: 'user', status: 'new' }); 
    }
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});



// User profile update



app.patch('/users/update/:email', async (req, res) => {
  const email = req.params.email;
  const updateData = req.body; 

  try {
    const filter = { email: email };
    
    // save database
    const updateDoc = {
      $set: updateData, 
    };

    const result = await usersCollection.updateOne(filter, updateDoc);

    if (result.matchedCount > 0) {
      res.send({ 
        success: true, 
        message: "User updated successfully",
        modifiedCount: result.modifiedCount 
      });
    } else {
      res.status(404).send({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).send({ success: false, error: error.message });
  }
});




    app.get('/publicHabits', async (req, res) => {
  try {
    const result = await habitCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching public habits:", error);
    res.status(500).send({ message: "Failed to fetch public habits", error });
  }
});



app.get("/publicHabits", async (req, res) => {
  try {
    const result = await publicHabitsCollection.aggregate([
      {
        $lookup: {
          from: "users",             
          localField: "userEmail",   
          foreignField: "email",     
          as: "userDetails"          
        }
      },
      {
        $unwind: {
          path: "$userDetails",
          preserveNullAndEmptyArrays: true 
        }
      },
      {
        $project: {
          
          _id: 1,
          habitName: 1,
          imageURL: 1,
          shortDescription: 1,
          category: 1,
          createDate: 1,
          isFeatured: 1,
          userEmail: 1,
          
          creatorName: { $ifNull: ["$userDetails.name", "$creatorName"] },
          creatorImage: { $ifNull: ["$userDetails.photoURL", "$creatorImage"] }
        }
      }
    ]).toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});


// 1. Sob user load korar endpoint (Admin User Directory-r jonno)
app.get('/users', async (req, res) => {
  try {
    const result = await usersCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ message: "Failed to fetch users" });
  }
});



// 2. User-er role update korar endpoint (Admin action-er jonno)
app.patch('/users/role/:email', async (req, res) => {
  const email = req.params.email;
  const { role } = req.body;
  
  const filter = { email: email };
  const updateDoc = {
    $set: { role: role },
  };

  try {
    const result = await usersCollection.updateOne(filter, updateDoc);
    if (result.modifiedCount > 0) {
      res.send({ message: "User role updated successfully", success: true });
    } else {
      res.status(404).send({ message: "User not found or role unchanged" });
    }
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).send({ message: "Failed to update role" });
  }
});





// Server.js file-e thik eivabe thakte hobe
app.get('/global-analytics', async (req, res) => {
  try {
    const totalUsers = await usersCollection.estimatedDocumentCount();
    const publicHabits = await habitCollection.estimatedDocumentCount();
    const totalPersonalHabits = await myHabitCollection.estimatedDocumentCount();
    
    // Aggregation for completions
    const completionStats = await habitCollection.aggregate([
      { $project: { count: { $size: { $ifNull: ["$completionHistory", []] } } } },
      { $group: { _id: null, total: { $sum: "$count" } } }
    ]).toArray();

    res.json({
      totalUsers,
      publicHabits,
      totalPersonalHabits,
      totalCompletions: completionStats[0]?.total || 0,
      systemHealth: "Optimal"
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch global analytics" });
  }
});








// new collection
const completionCollection = db.collection('check-habit-completion');



// check mark as complete button 
app.get('/check-status/:id/:email', async (req, res) => {
  const { id, email } = req.params;
  const today = new Date().toISOString().split("T")[0];

  try {
    const isDone = await completionCollection.findOne({
      publicHabitId: id, 
      userEmail: email,
      completionDate: today
    });
    
   
    res.send({ completed: !!isDone });
  } catch (error) {
    res.status(500).send({ message: "Error checking status" });
  }
});


app.post('/mark-complete-final', async (req, res) => {
  const { habit, userEmail, userName } = req.body;
  const today = new Date().toISOString().split("T")[0];

  try {
    const existing = await completionCollection.findOne({
      publicHabitId: habit._id,
      userEmail: userEmail,
      completionDate: today
    });

    if (existing) {
      return res.status(400).send({ message: "Already completed today!" });
    }

    const completionDoc = {
      ...habit,
      publicHabitId: habit._id,
      userEmail: userEmail,
      userName: userName,
      completionDate: today,
      timestamp: new Date()
    };
    
    delete completionDoc._id; 
    await completionCollection.insertOne(completionDoc);

    
    await habitCollection.updateOne(
      { _id: new ObjectId(habit._id) },
      { $push: { completionHistory: { userEmail: userEmail, date: today } } }
    );

   
    res.send({ success: true, completed: true });
  } catch (error) {
    res.status(500).send({ message: "Failed to save" });
  }
});



app.get("/publicHabits/:id/:email", async (req, res) => {
  const { id, email } = req.params;
  try {
    const habit = await habitCollection.findOne({ _id: new ObjectId(id) });
    if (!habit) return res.status(404).send({ message: "Habit not found" });

    
    const userSpecificHistory = habit.completionHistory?.filter(
      (entry) => entry.userEmail === email
    ) || [];

   
    habit.completionHistory = userSpecificHistory;
    
    res.send(habit);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch details" });
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










// Toggle Featured Status (isFeatured Update)
app.patch("/publicHabits/feature/:id", async (req, res) => {
  const id = req.params.id;
  const { isFeatured } = req.body;

  try {
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: { isFeatured: isFeatured },
    };

    const result = await habitCollection.updateOne(filter, updateDoc);

    if (result.matchedCount > 0) {
      res.send({ success: true, message: "Status updated in DB" });
    } else {
      res.status(404).send({ success: false, message: "Habit not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Internal Error" });
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













//  DELETE: MyHabit and PublicHabit 
app.delete("/myhabit/:id", async (req, res) => {
  const id = req.params.id;
  try {
    
    const habit = await myHabitCollection.findOne({ _id: new ObjectId(id) });
    
    if (!habit) {
      return res.status(404).send({ message: "Habit not found" });
    }

   
    const deleteResult = await myHabitCollection.deleteOne({ _id: new ObjectId(id) });

    
    if (habit.publicHabitId) {
      await habitCollection.deleteOne({ _id: new ObjectId(habit.publicHabitId) });
    } else {
      
      await habitCollection.deleteOne({ habitName: habit.habitName, creatorName: habit.creatorName });
    }

    res.send({ success: true, message: "Deleted from both collections" });
  } catch (error) {
    res.status(500).send({ message: "Server error during delete", error });
  }
});

//  PATCH: MyHabit and PublicHabit 
app.patch("/myhabit/:id", async (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  delete updates._id; 

  try {
    const habit = await myHabitCollection.findOne({ _id: new ObjectId(id) });
    if (!habit) return res.status(404).send({ message: "Habit not found" });

   
    const updateMyHabit = await myHabitCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    
    if (habit.publicHabitId) {
      await habitCollection.updateOne(
        { _id: new ObjectId(habit.publicHabitId) },
        { $set: updates }
      );
    } else {
      
      await habitCollection.updateOne(
        { habitName: habit.habitName, userEmail: habit.userEmail },
        { $set: updates }
      );
    }

    res.send({ success: true, message: "Updated successfully in both places" });
  } catch (error) {
    res.status(500).send({ message: "Server error during update", error });
  }
});




app.delete("/publicHabits/:id", async (req, res) => {
  const id = req.params.id;

  try {
    
    const habit = await habitCollection.findOne({ _id: new ObjectId(id) });

    if (!habit) {
      return res.status(404).send({ success: false, message: "Habit not found" });
    }

    
    const deletePublic = await habitCollection.deleteOne({ _id: new ObjectId(id) });

   
    const deleteMyHabit = await myHabitCollection.deleteMany({
      $or: [
        { publicHabitId: new ObjectId(id) }, 
        { publicHabitId: id },              
        { 
          habitName: habit.habitName,       
          userEmail: habit.userEmail 
        }
      ]
    });

    console.log(`Public Deleted: ${deletePublic.deletedCount}, MyHabit Deleted: ${deleteMyHabit.deletedCount}`);

    res.send({ 
      success: true, 
      message: "Deleted successfully from both collections",
      details: {
        publicCount: deletePublic.deletedCount,
        myHabitCount: deleteMyHabit.deletedCount
      }
    });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).send({ success: false, message: "Failed to delete", error: error.message });
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