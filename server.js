const express = require('express');
const fs = require("fs");
const pug = require("pug");
const path = require("path");
let app = express();
let mongo = require('mongodb');
var mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
let MongoClient = mongo.MongoClient;
const PORT = process.env.PORT || 3001
app.set("view engine", "pug");
app.use(express.static("public"));
app.use(express.json());
app.listen(PORT, console.log(`Server started on port ${PORT}`))
// app.use(session({ 
//     secret: 'some secret key here',
    // resave:true,
    // saveUninitialized:false,
// }))

let mongoStore = new MongoDBStore({
    uri: 'mongodb://localhost:27017/sess',
    collection:'Sessionsdata'
});
app.use(session({
    secret:'some secret here',
    store:mongoStore,
    resave:true,
    saveUninitialized:false
}))
const users={};
let count=999;
//var gethome =require("./views/home");

MongoClient.connect("mongodb://localhost:27017",(err,client)=>{
    if (err){
        throw err;
    }

    let db = client.db("a4"); 

    app.route(["/","/home"])
    .get((req,res)=>{
        if (req.session.loggedin){//if logged in
        console.log(req.session.loggedin);
        let loggedin=req.session.loggedin;
        console.log(req.session);
        res.status(200).render("home",{loggedin:loggedin});
        }
        else{//if not logged in
            req.session.loggedin=false;
            console.log(req.session.loggedin);
            console.log(req.session);
            let loggedin=req.session.loggedin;
            res.status(200).render("home",{loggedin:loggedin});
        }
    });

    app.route("/orderform.html")//reders the order page
    .get((req,res)=>{
        if (req.session.loggedin){//if logged in
            res.status(200).render("orderform.html");
        }
        else{
            res.status(404).send("user not logged in");
        }
    });

    app.route("/registration")
    .get((req,res)=>{//renders the registration page
        res.status(200).render("registration");
    })
    .post((req,res)=>{//registers new users
        console.log("name: "+req.body.name,"password: "+req.body.password,"privacy: "+req.body.privacy);

        db.collection("users").find({username:req.body.name}).toArray(function(err,result){//gets a list of people from the database with the same name as the registering user
            console.log("register.post: "+result);
            if (err){
                console.log("error getting it")
                res.status(500).send("Error reading database");
                return;
            }
            else if(result.length==0){//if the listis empty there are no duplicate users
                db.collection("users").insertOne({username:req.body.name,password:req.body.password,privacy:req.body.privacy,order_history:[],loggedin:true},function (){//adds the new users account to the database
                    req.session.loggedin=true;
                    console.log(req.session.loggedin);
                    req.session.username=req.body.name;
                    res.status(200).send("successfully registered in");
                });
            }
            else {//if the user already existes
                res.status(404).send("User already exists");
                return;
            }

        });
    });

    app.route("/logout")
    .get((req,res)=>{// logs the user out
        if (req.session.loggedin){//if user was logged in
            db.collection("users").updateOne({username:req.session.username},{$set:{loggedin:false}}, function(err, result){
                req.session.loggedin=false;
                req.session.username=undefined;
                res.status(200).send("succefully logged out");
            });
        }
        else{// if user wasnt logged in
            res.status(404).send("No user was loggedin");
        }
    })

    app.route("/login")
    .get((req,res)=>{//renders the login page
        res.status(200).render("login");
    })
    .put((req,res)=>{//logs the user in
        console.log("name: "+req.body.name,"password: "+req.body.password);

        db.collection("users").find({username:req.body.name}).toArray(function(err,result){//gets a list of users with the give user name
            console.log("login.put: "+result);
            if (err){
                console.log("error getting it")
                res.status(500).send("Error reading database");
                return;
            }
            else if (result.length>0){//if the list isnt empty the user exists
                if (result[0].password.localeCompare(req.body.password)==0){//checks if the pasward given matches passward for the account
                    console.log(result[0]);
                    db.collection("users").updateOne({username:req.body.username},{$set:{loggedin:true}}, function(err, result){
                        req.session.loggedin=true;//flag to show a user is logged in
                        console.log(req.session.loggedin);
                        req.session.username=req.body.name;//logged in users name 
                        console.log("before redirect");
                        res.status(200).send("successfully logged in");
                    });
                }
                else{//passward was incorrect
                    res.status(404).send("passwaord is incorrect");
                    return;
                }
            }
            else {//the list is empty there isnt a user with that name
                res.status(404).send("User doesn't exist");
                return;
            }
        });
    });

    app.route("/users")
    .get((req,res)=>{//renders users page
        db.collection("users").find({privacy:true}).toArray(function(err,result){//gets a list of all the public users
            if (err){
                console.log("error getting it")
                res.status(500).send("Error reading database");
                return;
            }

            let loggedin=req.session.loggedin;
            res.status(200).render("users",{loggedin:loggedin,users:result});
        });
    });

    app.route("/users/:userID")
    .get((req,res)=>{//renders profile page
        console.log(req.params.userID);
        if ( req.params.userID==-1){//renders profile page for the user logged in
            db.collection("users").find({username:req.session.username}).toArray(function(err,result){//gets a list of users which match the logged in users name
                if (err){
                    console.log("error getting it")
                    res.status(500).send("Error reading database");
                    return;
                }

                req.session.user=result[0]._id;
                res.status(200).render("profile",{user:result[0],loggedin:req.session.loggedin,user_loggedin:true})
            });
        }
        else{//renders profile page for the user viewed in the users page
            db.collection("users").find({_id:mongoose.Types.ObjectId(req.params.userID)}).toArray(function(err,result){//gets a list of all users with the unique user id given
                if (err){
                    console.log("error getting it")
                    res.status(500).send("Error reading database");
                    return;
                }
                else if (result[0].privacy==true){//if user viewd is public
                    let user_loggedin=result[0].username.localeCompare(req.session.username)==0;
                    req.session.user=req.params.userID;
                    res.status(200).render("profile",{user:result[0],loggedin:req.session.loggedin,user_loggedin:user_loggedin})
                }
                else{//if user viewd is private
                    res.status(403).send("User is not public neither are they logged in")
                }
            });
        }
    });

    app.route("/orders")
    .post((req,res)=>{//updates the order history of the logged in user 
        count++
        req.body.id=count;
        console.log(req.body);
        if (req.session.loggedin){//if user logged in
            db.collection("users").updateOne({username:req.session.username},{$push:{order_history:req.body}}, function(err, result){//adds an order to the order history of the logged in user
                if (err){
                    console.log("error getting it")
                    res.status(500).send("Error reading database");
                    return;
                }

                res.status(200).send("order saved");
            });
        }
        else{//if user not looged in
            res.status(404).send("User not logged in");
        }
    });

    app.route("/orders/:orderid")
    .get((req,res)=>{//renders the order summery for the order selected
        
        db.collection("users").find({_id:mongoose.Types.ObjectId(req.session.user)}).toArray(function(err,result){//gets the infomation for the user being viewed
            if (err){
                console.log("error getting it")
                res.status(500).send("Error reading database");
                return;
            }

            let order;

            for (let i=0;i<result[0].order_history.length;i++){
                if (result[0].order_history[i].id==req.params.orderid){
                    order=result[0].order_history[i];
                }
            }
            res.status(200).render("order_summery",{order:order,loggedin:req.session.loggedin,username:result[0].username})
        });
    });

    app.route("/toggle")
    .put((req,res)=>{//toggles the privacy property of the logged in users 
        db.collection("users").find({_id:mongoose.Types.ObjectId(req.session.user)}).toArray(function(err,result){//gets a list which conains the information for the logged in user
            if (err){
                console.log("error getting it")
                res.status(500).send("Error reading database");
                return;
            }
            else if (result[0].privacy==req.body.privacy){//if the logged in users privacy property doesnt need changing
                res.status(200).send("privacy is already "+req.body.privacy);
            }
            else{//if the logged in users privacy property does need changing
                console.log(req.body);
                db.collection("users").updateOne({_id:mongoose.Types.ObjectId(req.session.user)},{$set:{privacy:req.body.privacy},$currentDate: { lastModified: true }}, function(err, result){//toggles the logged in users privacy policy
                    if (err){
                        console.log("error getting it")
                        res.status(500).send("Error reading database");
                        return;
                    }
                    res.status(200).send("Change made");
                });
            }
        });
    })

    app.listen(3000);
        console.log("Listening on port 3000");
        console.log("Server listening at http://localhost:3000");
    });