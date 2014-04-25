/**
 * Created by zsolt on 4/24/14.
 */

define([], function(){

    var BlobMetadata = function(metadata) {
        if (metadata) {
            this.name = metadata.name;
            this.size = metadata.size || 0;
            this.mime = metadata.mime || '';
            this.tags = metadata.tags || [];
            this.content = metadata.content;
            this.contentType = metadata.contentType || BlobMetadata.CONTENT_TYPES.OBJECT;
        } else {
            throw new Error('metadata parameter is not defined');
        }
    };

    BlobMetadata.CONTENT_TYPES = {
        OBJECT: 'object',
        COMPLEX: 'complex',
        SOFT_LINK: 'soft-link'
    };

    BlobMetadata.prototype.serialize = function () {
        var metadata = {
            name: this.name,
            size: this.size,
            mime: this.mime,
            tags: this.tags,
            content: this.content,
            contentType: this.contentType
        };

        metadata.tags.sort();

        if (this.contentType === BlobMetadata.CONTENT_TYPES.COMPLEX) {
            // override on  purpose to normalize content
            metadata.content = {};
            var fnames = Object.keys(this.content);
            fnames.sort();

            for (var j = 0; j < fnames.length; j += 1) {
                metadata.content[fnames[j]] = this.content[fnames[j]];
            }
        }

        return metadata;
    };

    return BlobMetadata
});