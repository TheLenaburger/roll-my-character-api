// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

// pull in Mongoose model for characters
const Character = require('../models/character')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// this is middleware that will remove blank fields from `req.body`, e.g.
// { character: { title: '', text: 'foo' } } -> { character: { text: 'foo' } }
const removeBlanks = require('../../lib/remove_blank_fields')
// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `req.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// INDEX
// GET /characters
router.get('/characters', requireToken, (req, res, next) => {
  Character.find()
    // respond with status 200 and JSON of the characters
    .then(characters => res.status(200).json({ characters: characters }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// SHOW
// GET /characters/5a7db6c74d55bc51bdf39793
router.get('/characters/:id', requireToken, (req, res, next) => {
  // req.params.id will be set based on the `:id` in the route
  Character.findById(req.params.id)
    .then(handle404)
    // if `findById` is successful, respond with 200 and "example" JSON
    .then(character => res.status(200).json({ character: character }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// CREATE
// POST /characters
router.post('/characters', requireToken, (req, res, next) => {
  // set owner of new character to be current user
  req.body.character.owner = req.user.id

  Character.create(req.body.character)
    // respond to successful `create` with status 201 and JSON of new "character"
    .then(character => {
      res.status(201).json({ character })
    })
    // if an error occurs, pass it off to our error handler
    // the error handler needs the error message and the `res` object so that it
    // can send an error message back to the client
    .catch(next)
})

// UPDATE
// PATCH /characters/5a7db6c74d55bc51bdf39793
router.patch('/characters/:id', requireToken, removeBlanks, (req, res, next) => {
  // if the client attempts to change the `owner` property by including a new
  // owner, prevent that by deleting that key/value pair
  delete req.body.character.owner

  Character.findById(req.params.id)
    .then(handle404)
    // ensure the signed in user (req.user.id) is the same as the character's owner (character.owner)
    .then(character => requireOwnership(req, character))
    // updating character object with characterData
    .then(character => character.updateOne(req.body.character))
    // if that succeeded, return 204 and no JSON
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// DESTROY
// DELETE /characters/5a7db6c74d55bc51bdf39793
router.delete('/characters/:id', requireToken, (req, res, next) => {
  Character.findById(req.params.id)
    .then(handle404)
    // ensure the signed in user (req.user.id) is the same as the character's owner (character.owner)
    .then(character => requireOwnership(req, character))
    // delete character from mongodb
    .then(character => character.deleteOne())
    // send back 204 and no content if the deletion succeeded
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

module.exports = router
