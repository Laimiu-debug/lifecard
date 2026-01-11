/**
 * Validator 工具测试
 */
import { Validator, ValidationLimits, CardCreateData } from '../../../utils/validator';

describe('Validator', () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  describe('validateCardCreate', () => {
    it('should pass for valid card data', () => {
      const data: CardCreateData = {
        card_type: 'day_card',
        title: 'Test Title',
        description: 'Test Description',
      };
      
      const result = validator.validateCardCreate(data);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should fail when card_type is missing', () => {
      const data: CardCreateData = {
        title: 'Test Title',
        description: 'Test Description',
      };
      
      const result = validator.validateCardCreate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.card_type).toBeDefined();
    });

    it('should fail when title is empty', () => {
      const data: CardCreateData = {
        card_type: 'day_card',
        title: '',
        description: 'Test Description',
      };
      
      const result = validator.validateCardCreate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.title).toBeDefined();
    });

    it('should fail when title exceeds max length', () => {
      const data: CardCreateData = {
        card_type: 'day_card',
        title: 'a'.repeat(ValidationLimits.TITLE_MAX_LENGTH + 1),
        description: 'Test Description',
      };
      
      const result = validator.validateCardCreate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.title).toContain('200');
    });


    it('should fail when description is empty', () => {
      const data: CardCreateData = {
        card_type: 'day_card',
        title: 'Test Title',
        description: '',
      };
      
      const result = validator.validateCardCreate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.description).toBeDefined();
    });

    it('should fail when media exceeds 9 images', () => {
      const data: CardCreateData = {
        card_type: 'day_card',
        title: 'Test Title',
        description: 'Test Description',
        media: Array(10).fill({ id: '1', media_type: 'image', url: 'test.jpg' }),
      };
      
      const result = validator.validateCardCreate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.media).toBeDefined();
    });

    it('should fail when more than 1 video', () => {
      const data: CardCreateData = {
        card_type: 'day_card',
        title: 'Test Title',
        description: 'Test Description',
        media: [
          { id: '1', media_type: 'video', url: 'test1.mp4' },
          { id: '2', media_type: 'video', url: 'test2.mp4' },
        ],
      };
      
      const result = validator.validateCardCreate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.media).toContain('1个视频');
    });

    it('should fail when emotion_tags exceeds 10', () => {
      const data: CardCreateData = {
        card_type: 'day_card',
        title: 'Test Title',
        description: 'Test Description',
        emotion_tags: Array(11).fill('tag'),
      };
      
      const result = validator.validateCardCreate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.emotion_tags).toBeDefined();
    });

    it('should fail when interest_tags exceeds 10', () => {
      const data: CardCreateData = {
        card_type: 'day_card',
        title: 'Test Title',
        description: 'Test Description',
        interest_tags: Array(11).fill('tag'),
      };
      
      const result = validator.validateCardCreate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.interest_tags).toBeDefined();
    });
  });

  describe('validateComment', () => {
    it('should pass for valid comment', () => {
      const result = validator.validateComment('This is a valid comment');
      expect(result.valid).toBe(true);
    });

    it('should fail for empty comment', () => {
      const result = validator.validateComment('');
      expect(result.valid).toBe(false);
      expect(result.errors.content).toBeDefined();
    });

    it('should fail for whitespace-only comment', () => {
      const result = validator.validateComment('   ');
      expect(result.valid).toBe(false);
      expect(result.errors.content).toBeDefined();
    });

    it('should fail when comment exceeds max length', () => {
      const result = validator.validateComment('a'.repeat(501));
      expect(result.valid).toBe(false);
      expect(result.errors.content).toContain('500');
    });
  });

  describe('validateFolderName', () => {
    it('should pass for valid folder name', () => {
      const result = validator.validateFolderName('My Folder');
      expect(result.valid).toBe(true);
    });

    it('should fail for empty name', () => {
      const result = validator.validateFolderName('');
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBeDefined();
    });

    it('should fail when name exceeds max length', () => {
      const result = validator.validateFolderName('a'.repeat(51));
      expect(result.valid).toBe(false);
      expect(result.errors.name).toContain('50');
    });
  });

  describe('validateProfileUpdate', () => {
    it('should pass for valid profile data', () => {
      const result = validator.validateProfileUpdate({
        nickname: 'TestUser',
        bio: 'Hello world',
      });
      expect(result.valid).toBe(true);
    });

    it('should fail for empty nickname', () => {
      const result = validator.validateProfileUpdate({ nickname: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.nickname).toBeDefined();
    });

    it('should fail when bio exceeds max length', () => {
      const result = validator.validateProfileUpdate({
        bio: 'a'.repeat(501),
      });
      expect(result.valid).toBe(false);
      expect(result.errors.bio).toContain('500');
    });
  });

  describe('validateExchangeBalance', () => {
    it('should pass when balance is sufficient', () => {
      const result = validator.validateExchangeBalance(100, 50);
      expect(result.valid).toBe(true);
    });

    it('should fail when balance is insufficient', () => {
      const result = validator.validateExchangeBalance(30, 50);
      expect(result.valid).toBe(false);
      expect(result.errors.balance).toBeDefined();
    });
  });
});
