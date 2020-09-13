const sgMail = require('@sendgrid/mail'); // SENDGRID_API_KEY
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const ErrorHandler=require('../helpers/dbErrorHandler')

exports.contactForm = (req, res) => {
    const { email, name, message } = req.body;
    // console.log(req.body);

    const emailData = {
        to: email,
        from: process.env.AUTH_EMAIL,
        subject: `Contact form - ${process.env.APP_NAME}`,
        text: `Email received from contact from \n Sender name: ${name} \n Sender email: ${email} \n Sender message: ${message}`,
        html: `
            <h4>Email received from contact form:</h4>
            <p>Sender name: ${name}</p>
            <p>Sender email: ${email}</p>
            <p>Sender message: ${message}</p>
            <hr />
            <p>This email may contain sensetive information</p>
            <p>https://seoblog.com</p>
        `
    };

    sgMail.send(emailData).then(sent => {
        return res.json({
            success: true
        });
    }).catch((error) => {
        console.log(error.response.body)
        return res.status(401).json({
            error: ErrorHandler.errorHandler(error)
        });
       
        
        // console.log(error.response.body.errors[0].message)
    })
};

exports.contactBlogAuthorForm = (req, res) => {
    const { authorEmail, name, message } = req.body;
    // console.log(req.body);

    let maillist = [authorEmail];

    const emailData = {
        to: maillist,
        from: process.env.AUTH_EMAIL,
        subject: `Someone messaged you from ${process.env.APP_NAME}`,
        text: `Email received from contact from \n Sender name: ${name} \n Sender email: ${email} \n Sender message: ${message}`,
        html: `
            <h4>Message received from:</h4>
            <p>name: ${name}</p>
            <p>Email: ${email}</p>
            <p>Message: ${message}</p>
            <hr />
            <p>This email may contain sensetive information</p>
            <p>https://seoblog.com</p>
        `
    };

    sgMail.send(emailData).then(sent => {
        return res.json({
            success: true
        });
    }).catch((error) => {
        console.log(error.response.body)
        res.send(error.response.body)
        // console.log(error.response.body.errors[0].message)
    })
};