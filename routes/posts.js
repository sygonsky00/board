// routes/posts.js

var express = require('express');
var router = express.Router();
var Post = require('../models/Post');
var util = require('../util');

// index
// router.get('/', function (req, res) {
//   Post.find({})
//   .populate('author')
//   .sort('-createdAt')
//   .exec(function (err, posts) {
//     if(err) return res.json(err);
//     res.render('posts/index', {posts:posts});
//   });
// });
router.get('/', async function (req, res) {
  var page = Math.max(1, parseInt(req.query.page));
  var limit = Math.max(1, parseInt(req.query.limit));
  page = !isNaN(page)?page:1;
  limit = !isNaN(limit)?limit:10;

  var searchQuery = createSearchQuery(req.query);

  var skip = (page-1)*limit;
  var count = await Post.countDocuments({});
  var maxPage = Math.ceil(count/limit);
  var posts = await Post.find({})
    .populate('author')
    .sort('-createdAt')
    .skip(skip)
    .limit(limit)
    .exec();

  res.render('posts/index', {
    posts:posts,
    currentPage:page,
    maxPage:maxPage,
    limit:limit
  });
});


// New
router.get('/new', util.isLoggedin, function (req, res) {
  var post = req.flash('post')[0] || {};
  var errors = req.flash('errors')[0] || {};
  res.render('posts/new', { post:post, errors:errors });
});

// create
router.post('/', util.isLoggedin, function (req, res) {
  req.body.author = req.user._id;
  Post.create(req.body, function (err, post) {
    if(err) {
      req.flash('post', req.body);
      req.flash('errors', util.parseError(err));
      return res.redirect('/posts/new'+res.locals.getPostQueryString());
    }
    res.redirect('/posts'+res.locals.getPostQueryString(false, {page:1}));
  });
});

// show
router.get('/:id', function (req, res) {
  Post.findOne({_id:req.params.id})
    .populate('author')
    .exec(function (err, post) {
      if(err) return res.json(err);
      res.render('posts/show', {post:post});
  });
});

// edit
router.get('/:id/edit', util.isLoggedin, checkPermission, function (req, res) {
  var post = req.flash('post')[0];
  var errors = req.flash('errors')[0] || {};
  if(!post){
    Post.findOne({_id:req.params.id}, function (err, post) {
      if(err) return res.json(err);
      res.render('posts/edit', { post:post, errors:errors});
    });
  }
  else{
    post._id = req.params.id;
    res.render('posts/edit', { post:post, errors:errors});
  }
});

// update
router.put('/:id', util.isLoggedin, checkPermission, function (req, res) {
  req.body.updatedAt = Date.now();
  Post.findOneAndUpdate({_id:req.params.id}, req.body, {runValidators:true}, function (err, post) {
    if(err) {
      req.flash('post', req.body);
      req.flash('errors', util.parseError(err));
      return res.redirect('/posts/'+req.params.id+'/edit'+res.locals.getPostQueryString());
    }
    res.redirect('/posts/'+req.params.id+res.locals.getPostQueryString());
  });
});

// destroy
router.delete('/:id', util.isLoggedin, checkPermission, function (req, res) {
  Post.deleteOne({_id:req.params.id}, function (err) {
      if(err) return res.json(err);
      res.redirect('/posts'+res.locals.getPostQueryString());
  });
});

module.exports = router;

// private functions
function checkPermission(req, res, next) {
  Post.findOne({_id:req.params.id}, function (err, post) {
    if(err) return res.json(err);
    if(post.author != req.user.id) return util.noPermission(req, res);

    next();
  });
}

function createSearchQuery(queries) {
  var searchQuery = {};
  if(queries.searchType && queries.searchText && queries.searchText.length >= 3){
    var searchType = queries.searchType.toLowerCase().split(',');
    var postQueries = [];
    if(searchType.indexOf('title')>=0){
      postQueries.push({title: { $regex: new RegExp(queries.searchText, 'i')}});
    }
    if(searchType.indexOf('body')>=0){
      postQueries.push({body: { $regex: new RegExp(queries.searchText, 'i')}});
    }
    if(postQueries.length > 0) searchQuery = {$or:postQueries};
  }
  return searchQuery;
}
