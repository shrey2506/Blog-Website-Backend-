const User = require('../models/user');
const shortId = require('shortid');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const Blog = require('../models/blog');
const _ =require('lodash');
const { errorHandler } = require('../helpers/dbErrorHandler');
const sgMail = require('@sendgrid/mail'); // SENDGRID_API_KEY
sgMail.setApiKey(process.env.SENDGRID_API_KEY);


// exports.signup = (req, res) => {
//     // console.log(req.body);
//     User.findOne({ email: req.body.email }).exec((err, user) => {
//         if (user) {
//             return res.status(400).json({
//                 error: 'Email is taken'
//             });
//         }

//         const { name, email, password } = req.body;
//         let username = shortId.generate();
//         let profile = `${process.env.CLIENT_URL}/profile/${username}`;

//         let newUser = new User({ name, email, password, profile, username });
//         newUser.save((err, success) => {
//             if (err) {
//                 return res.status(400).json({
//                     error: err
//                 });
//             }
//             // res.json({
//             //     user: success
//             // });
//             res.json({
//                 message: 'Signup success! Please signin.'
//             });
//         });
//     });
// };

exports.signup = (req, res) => {
    const token = req.body.token;
    if (token) {
        jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function(err, decoded) {
            if (err) {
                return res.status(401).json({
                    error: 'Expired link. Signup again'
                });
            }

            const { name, email, password } = jwt.decode(token);

            let username = shortId.generate();
            let profile = `${process.env.CLIENT_URL}/profile/${username}`;

            const user = new User({ name, email, password, profile, username });
            user.save((err, user) => {
                if (err) {
                    return res.status(401).json({
                        error: errorHandler(err)
                    });
                }
                return res.json({
                    message: 'Singup success! Please signin'
                });
            });
        });
    } else {
        return res.json({
            message: 'Something went wrong. Try again'
        });
    }
};



exports.signin = (req, res) => {
    const { email, password } = req.body;
    // check if user exist
    User.findOne({ email }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User with that email does not exist. Please signup.'
            });
        }
        // authenticate
        if (!user.authenticate(password)) {
            return res.status(400).json({
                error: 'Email and password do not match.'
            });
        }
        // generate a token and send to client
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.cookie('token', token, { expiresIn: '1d' });
        const { _id, username, name, email, role } = user;
        return res.json({
            token,
            user: { _id, username, name, email, role }
        });
    });
};

exports.signout = (req, res) => {
    res.clearCookie('token');
    res.json({
        message: 'Signout success'
    });
};

exports.requireSignin = expressJwt({
    secret: process.env.JWT_SECRET
});

exports.authMiddleware = (req, res, next) => {
    const authUserId = req.user._id;
    User.findById({ _id: authUserId }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User not found'
            });
        }
        req.profile = user;
        next();
    });
};

exports.adminMiddleware = (req, res, next) => {
    const adminUserId = req.user._id;
    User.findById({ _id: adminUserId }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User not found'
            });
        }

        if (user.role !== 1) {
            return res.status(400).json({
                error: 'Admin resource. Access denied'
            });
        }

        req.profile = user;
        next();
    });
};

exports.canUpdateDeleteBlog=(req,res,next)=>{
    const slug=req.params.slug.toLowerCase();
    Blog.findOne({slug}).exec((err,data)=>{
        if(err){
            return res.status(400).json({
                error: errorHandler(err)
            });
        }
        let authorizedUser=data.postedBy._id.toString()===req.profile._id.toString();
        if(!authorizedUser){
            return res.status(400).json({
                error: 'You are not authorized'
            });
        }
        next();
    });
}


exports.forgotPassword=(req,res)=>{
    const {email}= req.body;

    User.findOne({email}, (err,user)=>{
          if(err|| !user){
             return res.status(401).json({
                 error: 'User with that email does not exist'
             });
          }
          const token=jwt.sign({_id: user._id}, process.env.JWT_RESET_PASSWORD, {expiresIn: '10m'});

          //send email
          const emailData = {
            to: email,
            from: process.env.AUTH_EMAIL,
            subject: `Password Reset Link`,
            
            html: `
                <h4>Please use the following link to reset your password:</h4>
                <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
                <p>Sender email: ${email}</p>
                
                <hr />
                <p>This email may contain sensetive information</p>
                <p>https://seoblog.com</p>
            `
        };

        //populating the db> user> resetPasswordLink
        return User.updateOne({resetPasswordLink: token},(err,success)=>{
            if(err){
                return res.json({json: errorHandler(err)});
            }
            else{

                    sgMail.send(emailData).then(sent => {
                        return res.json({
                            message: `Email has been sent to ${email}. Follow the instructions to reset your password.\n Link expires in 10min`
                        });

                    }).catch((error) => {
                        console.log(error.response.body)
                        return res.status(401).json({
                            error: ErrorHandler.errorHandler(error)
                        });
               
            });
          }
            
      });
   });
}

exports.resetPassword=(req,res)=>{
    const {resetPasswordLink, newPassword}=req.body;

    if(resetPasswordLink){
        jwt.verify(resetPasswordLink, process.env.JWT_RESET_PASSWORD, function(err,decoded){
            if(err){
                return res.status(401).json({
                    error: 'The following link is expired. Please Try Again'
                })
            }
            User.findOne({resetPasswordLink}, (err,user)=>{
                if(err|| !user){
                    return res.status(401).json({
                        error: 'Something went wrong. Try again later'
                    });
                }

                const updatedFields={
                    password: newPassword,
                    resetPasswordLink: ''
                }

                user=_.extend(user, updatedFields);

                user.save((err,result)=>{
                    if(err){
                        return res.status(400).json({
                            error: errorHandler(err)
                        });
                    }
                    res.json({
                        message: `Password Updated Successfully. Please Login with your new password.`
                    })
                });
            });
        });
    }
}

exports.preSignup=(req,res)=>{
    const {name,email,password}=req.body;
    User.findOne({email: email.toLowerCase()}, (err,user)=>{
        if(user){
            return res.status(400).json({
               error: 'Email is already taken'
            });
        }
        const token=jwt.sign({name,email,password}, process.env.JWT_ACCOUNT_ACTIVATION, { expiresIn: '10m' });

        const emailData = {
            to: email,
            from: process.env.AUTH_EMAIL,
            subject: `Account Activation Link`,
            
            html: `
                <h4>Please use the following link to activate your password:</h4>
                <p>${process.env.CLIENT_URL}/auth/account/activate/${token}</p>
                <p>Sender email: ${email}</p>
                
                <hr />
                <p>This email may contain sensetive information</p>
                <p>https://seoblog.com</p>
            `
        };

        sgMail.send(emailData).then(sent => {
            return res.json({
                message: `Email has been sent to ${email}. Follow the instructions to activate your password.\n Link expires in 10min`
            });

        }).catch((error) => {
            console.log(error.response.body)
            return res.status(401).json({
                error: ErrorHandler.errorHandler(error)
            });
        });

    })
}