const Sauce = require('../models/Sauce');
const fs = require('fs');
const { findOne } = require('../models/Sauce');

exports.createSauce = (req, res, next) => {
  const sauceObject = JSON.parse(req.body.sauce);
  delete sauceObject._id;
  delete sauceObject._userId;
  const sauce = new Sauce({
      ...sauceObject,
      userId: req.auth.userId,
      imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
  });

  sauce.save()
  .then(() => { res.status(201).json({message: 'Objet enregistré !'})})
  .catch(error => { res.status(400).json( { error })})
};

exports.getOneSauce = (req, res, next) => {
  Sauce.findOne({
    _id: req.params.id
  }).then(
    (sauce) => {
      res.status(200).json(sauce);
    }
  ).catch(
    (error) => {
      res.status(404).json({
        error: error
      });
    }
  );
};

exports.modifySauce = (req, res, next) => {
  const sauceObject = req.file ? {
      ...JSON.parse(req.body.sauce),
      imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
  } : { ...req.body };

  delete sauceObject._userId;
  Sauce.findOne({_id: req.params.id})
      .then((sauce) => {
          if (sauce.userId != req.auth.userId) {
              res.status(401).json({ message : 'Not authorized'});
          } else {
              Sauce.updateOne({ _id: req.params.id}, { ...sauceObject, _id: req.params.id})
              .then(() => res.status(200).json({message : 'Objet modifié!'}))
              .catch(error => res.status(401).json({ error }));
          }
      })
      .catch((error) => {
          res.status(400).json({ error });
      });
      
};

  exports.deleteSauce = (req, res, next) => {
    Sauce.findOne({ _id: req.params.id})
        .then(sauce => {
            if (sauce.userId != req.auth.userId) {
                res.status(401).json({message: 'Not authorized'});
            } else {
                const filename = sauce.imageUrl.split('/images/')[1];
                fs.unlink(`images/${filename}`, () => {
                    Sauce.deleteOne({_id: req.params.id})
                        .then(() => { res.status(200).json({message: 'Objet supprimé !'})})
                        .catch(error => res.status(401).json({ error }));
                });
            }
        })
        .catch( error => {
            res.status(500).json({ error });
        });
 };

exports.getAllSauce = (req, res, next) => {
  Sauce.find().then(
    (sauces) => {
      res.status(200).json(sauces);
    }
  ).catch(
    (error) => {
      res.status(400).json({
        error: error
      });
    }
  );
};

// gère les Likes et Dislikes des sauces
exports.likeAndDislike = (req, res, next) => {
	const { like, userId } = req.body
	if (![1, 0, -1].includes(like)) {
		return res.status(403).send({ message: "Like/Dislike: Quantité invalide !" })
	}
	let likeString = like.toString();
	switch (likeString) {
		case '1': {
			// met un Like
			Sauce.updateOne(
				{
					// enregistre l'ID de l'utilisateur
					_id: req.params.id, 
				},
				{
					// Incrémente le champs "nombre d'utilisateurs qui ont mis un Like"
					$inc: { likes: req.body.like++ }, 
					// Enregistre l'ID de l'utilisateur dans le table de ceux qui ont aimés
					$push: { usersLiked: req.body.userId }, 
				}
			)
				.then((sauce) => res.status(200).json({ message: 'Like ajouté !' }))
				.catch((error) => res.status(400).json({ error }));
			break;
		}

		case '-1': {
			// met un Dislike
			Sauce.updateOne(
				{
					// enregistre l'ID de l'utilisateur
					_id: req.params.id,
				},
				{
					// Incrémente le champs "nombre d'utilisateurs qui ont mis un Dislike"
					$inc: { dislikes: req.body.like++ * -1 },
					// Enregistre l'ID de l'utilisateur dans le table de ceux qui n'ont aimés
					$push: { usersDisliked: req.body.userId },
				}
			)
				.then((sauce) => res.status(200).json({ message: 'Dislike ajouté !' }))
				.catch((error) => res.status(400).json({ error }));
			break;
		}

		default: {
			// supprime un Like ou un Dislike
			Sauce.findOne({ _id: req.params.id })
				.then((sauce) => {
					// test si le userId est dans le tableau des personnes qui ont liké la sauce
					if (sauce.usersLiked.includes(req.body.userId)) {
						Sauce.updateOne(
							{
								// enregistre l'ID de l'utilisateur
								_id: req.params.id,
							},
							{
								// enregistre l'ID de l'utilisateur dans le table de ceux qui ont aimés
								$pull: { usersLiked: req.body.userId },
								// supprime le Like
								$inc: { likes: -1 },
							}
						)
							.then((sauce) => {
								res.status(200).json({ message: 'Like supprimé !' });
							})
							.catch((error) => res.status(400).json({ error }));
					}
					// test si le userId est dans le tableau des personnes qui ont Disliké la sauce
					else if (sauce.usersDisliked.includes(req.body.userId)) {
						Sauce.updateOne(
							{
								// enregistre l'ID de l'utilisateur
								_id: req.params.id,
							},
							{
								// enregistre l'ID de l'utilisateur dans le table de ceux qui n'ont aimés
								$pull: { usersDisliked: req.body.userId },
								// supprime le Dislike
								$inc: { dislikes: -1 },
							}
						)
							.then((sauce) => {
								res.status(200).json({ message: 'Dislike supprimé !' });
							})
							.catch((error) => res.status(400).json({ error }));
					}
				})
				.catch((error) => res.status(400).json({ error }));
		}
	}
};